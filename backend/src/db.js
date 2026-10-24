const { MongoClient } = require('mongodb');
const config = require('./config');

let client = null;
let db = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class DatabaseUnavailableError extends Error {
  constructor(message = 'Database is not connected') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

// Connect to MongoDB over the Docker network, retrying while the container starts.
async function connectWithRetry(maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      db = client.db(config.dbName);
      await db.command({ ping: 1 });
      console.log(`[db] Connected to ${config.mongoUri} (database: ${config.dbName})`);
      return db;
    } catch (err) {
      console.error(`[db] Connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (client) await client.close().catch(() => {});
      client = null;
      db = null;
      if (attempt === maxAttempts) throw err;
      await sleep(delayMs);
    }
  }
  return null;
}

function getDb() {
  if (!db) throw new DatabaseUnavailableError();
  return db;
}

// JSON-schema validator for the input collection (validation lives in MongoDB itself).
const inputValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['report_id', 'server_id', 'server_name', 'metric_type', 'threshold', 'readings', 'timestamp'],
    properties: {
      report_id: { bsonType: 'string' },
      server_id: { bsonType: 'string' },
      server_name: { bsonType: 'string' },
      metric_type: { enum: [config.metricType] },
      threshold: { bsonType: 'number', minimum: 0, maximum: 100 },
      timestamp: { bsonType: 'date' },
      readings: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['Time', 'CpuUtil'],
          properties: {
            Time: { bsonType: 'date' },
            CpuUtil: { bsonType: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
    },
  },
};

// Make sure exactly the two project collections exist, with their indexes.
async function ensureCollections() {
  const database = getDb();
  const existing = (await database.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);

  if (!existing.includes(config.collections.input)) {
    await database.createCollection(config.collections.input, { validator: inputValidator });
  } else {
    await database.command({ collMod: config.collections.input, validator: inputValidator });
  }
  if (!existing.includes(config.collections.result)) {
    await database.createCollection(config.collections.result);
  }

  const input = database.collection(config.collections.input);
  const result = database.collection(config.collections.result);
  await input.createIndex({ report_id: 1 }, { unique: true, name: 'uniq_report_id' });
  await input.createIndex({ server_id: 1, timestamp: -1 }, { name: 'server_time' });
  // Required by $merge "on: server_id" and guarantees one summary per server.
  await result.createIndex({ server_id: 1 }, { unique: true, name: 'uniq_server_id' });
}

module.exports = { connectWithRetry, getDb, ensureCollections, DatabaseUnavailableError };
