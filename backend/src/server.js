const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const config = require('./config');
const { connectWithRetry, getDb, ensureCollections, DatabaseUnavailableError } = require('./db');
const { runAggregation, getResults, summarize } = require('./aggregation');
const { buildSeedDocuments } = require('./seedData');
const { SERVERS } = require('./servers');
const { validateReading } = require('./validation');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

const inputCol = () => getDb().collection(config.collections.input);

// Wrap async handlers so errors reach the error middleware.
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class AggregationError extends Error {
  constructor(cause) {
    super(`Aggregation failed: ${cause.message}`);
    this.name = 'AggregationError';
  }
}

async function aggregateOrThrow() {
  try {
    return await runAggregation();
  } catch (err) {
    throw new AggregationError(err);
  }
}

async function inputTotals() {
  const [docCount, agg] = await Promise.all([
    inputCol().countDocuments(),
    inputCol()
      .aggregate([{ $group: { _id: null, readings: { $sum: { $size: '$readings' } } } }])
      .toArray(),
  ]);
  return { input_document_count: docCount, reading_count: agg[0] ? agg[0].readings : 0 };
}

// Idempotent seed: upsert the 12 sample documents by report_id.
// With reset=true, all input and result documents are removed first.
async function seed({ reset = false } = {}) {
  const db = getDb();
  if (reset) {
    await inputCol().deleteMany({});
    await db.collection(config.collections.result).deleteMany({});
  }
  const docs = buildSeedDocuments();
  const ops = docs.map((doc) => ({
    replaceOne: { filter: { report_id: doc.report_id }, replacement: doc, upsert: true },
  }));
  const bulk = await inputCol().bulkWrite(ops, { ordered: true });
  return {
    seed_documents: docs.length,
    seed_readings: docs.reduce((n, d) => n + d.readings.length, 0),
    inserted: bulk.upsertedCount,
    already_present: bulk.matchedCount,
  };
}

// ---------- Routes ----------

app.get('/api/health', async (req, res) => {
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .sort();
    res.json({
      status: 'ok',
      database: 'connected',
      database_name: config.dbName,
      collections,
      cpu_threshold: config.cpuThreshold,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/servers', route(async (req, res) => {
  const [stats, results] = await Promise.all([
    inputCol()
      .aggregate([
        { $group: { _id: '$server_id', input_documents: { $sum: 1 }, readings: { $sum: { $size: '$readings' } } } },
      ])
      .toArray(),
    getResults(),
  ]);
  const servers = SERVERS.map((s) => {
    const st = stats.find((x) => x._id === s.server_id);
    return {
      ...s,
      input_documents: st ? st.input_documents : 0,
      readings: st ? st.readings : 0,
      result: results.find((r) => r.server_id === s.server_id) || null,
    };
  });
  res.json({ count: servers.length, servers });
}));

app.get('/api/input', route(async (req, res) => {
  const filter = {};
  if (req.query.server_id) {
    if (!SERVERS.some((s) => s.server_id === req.query.server_id)) {
      return res.status(400).json({ error: 'Unknown server_id' });
    }
    filter.server_id = req.query.server_id;
  }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const [documents, totals] = await Promise.all([
    inputCol().find(filter).sort({ timestamp: -1, report_id: -1 }).limit(limit).toArray(),
    inputTotals(),
  ]);
  return res.json({ ...totals, returned: documents.length, documents });
}));

app.get('/api/results', route(async (req, res) => {
  const results = await getResults();
  res.json({ summary: summarize(results), results });
}));

app.post('/api/input', route(async (req, res) => {
  const { value, errors } = validateReading(req.body);
  if (errors) return res.status(400).json({ error: 'Invalid reading', details: errors });

  const { server, cpuUtil, time } = value;
  const doc = {
    report_id: `LIVE-${server.server_id}-${time.getTime()}-${crypto.randomBytes(3).toString('hex')}`,
    server_id: server.server_id,
    device_id: server.device_id,
    server_name: server.server_name,
    model: server.model,
    processor_vendor: server.processor_vendor,
    server_generation: server.server_generation,
    location_name: server.location_name,
    report_type: 'LIVE_CPU_READING',
    metric_type: config.metricType,
    unit: 'percent',
    threshold: config.cpuThreshold,
    readings: [{ Time: time, CpuUtil: cpuUtil }],
    timestamp: time,
    created_at: new Date(),
    source: 'dashboard',
  };

  const { insertedId } = await inputCol().insertOne(doc);
  // Real-time step: recalculate results immediately after the insert.
  const results = await aggregateOrThrow();
  const totals = await inputTotals();
  return res.status(201).json({
    message: `Reading ${cpuUtil}% stored for ${server.server_name}; results recalculated`,
    inserted: { ...doc, _id: insertedId },
    server_result: results.find((r) => r.server_id === server.server_id) || null,
    summary: summarize(results),
    ...totals,
    results,
  });
}));

app.post('/api/seed', route(async (req, res) => {
  const reset = Boolean(req.body && req.body.reset === true);
  const seedInfo = await seed({ reset });
  const results = await aggregateOrThrow();
  const totals = await inputTotals();
  res.json({
    message: reset ? 'Sample data reset and re-seeded' : 'Sample data seeded (idempotent upsert)',
    reset,
    ...seedInfo,
    ...totals,
    summary: summarize(results),
    results,
  });
}));

app.post('/api/aggregate', route(async (req, res) => {
  const results = await aggregateOrThrow();
  res.json({ message: 'Aggregation completed', summary: summarize(results), results });
}));

app.use('/api', (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` }));

// Error handling: bad JSON, DB unavailable, aggregation failure, anything else.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err instanceof DatabaseUnavailableError || /ECONNREFUSED|server selection|topology/i.test(err.message || '')) {
    return res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
  if (err instanceof AggregationError) {
    console.error('[aggregate]', err.message);
    return res.status(500).json({ error: 'Aggregation failed', details: err.message });
  }
  if (err.code === 121) {
    return res.status(400).json({ error: 'Document failed MongoDB schema validation', details: err.message });
  }
  console.error('[api]', err);
  return res.status(500).json({ error: 'Internal server error', details: err.message });
});

async function start() {
  await connectWithRetry();
  await ensureCollections();

  const count = await inputCol().countDocuments();
  if (count === 0 && config.autoSeed) {
    const info = await seed();
    console.log(`[seed] Auto-seeded ${info.seed_documents} documents / ${info.seed_readings} readings`);
  }
  if ((await inputCol().countDocuments()) > 0) {
    const results = await runAggregation();
    console.log(`[aggregate] Startup aggregation stored ${results.length} result documents`);
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[api] Backend listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
