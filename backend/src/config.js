// Central configuration, read from environment variables set by docker-compose.yml
const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  port: toNumber(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/server_health_monitoring',
  dbName: process.env.MONGO_DB_NAME || 'server_health_monitoring',
  cpuThreshold: toNumber(process.env.CPU_THRESHOLD, 80),
  autoSeed: String(process.env.AUTO_SEED || 'true').toLowerCase() === 'true',
  collections: {
    input: 'input',
    result: 'result',
  },
  metricType: 'CPU_UTILIZATION',
};
