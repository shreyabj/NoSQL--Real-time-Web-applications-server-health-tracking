const config = require('./config');
const { SERVERS } = require('./servers');

// Deterministic sample data: 3 servers x 4 documents x 3 hourly readings
// = 12 input documents and 36 individual readings.
//   Server-01: always below 80%            -> HEALTHY
//   Server-02: mostly at/above 80%         -> CRITICAL (average >= 80%)
//   Server-03: mostly normal, two spikes   -> WARNING  (max >= 80%, average < 80%)
const CPU_READINGS = {
  'SRV-01': [
    [32.5, 35.1, 38.4],
    [41.2, 45.8, 43.0],
    [47.6, 52.3, 49.9],
    [44.1, 39.7, 36.2],
  ],
  'SRV-02': [
    [78.4, 82.6, 85.1],
    [88.3, 91.7, 94.2],
    [89.5, 86.8, 92.4],
    [95.6, 90.3, 84.9],
  ],
  'SRV-03': [
    [55.2, 60.4, 58.7],
    [72.1, 81.5, 76.3],
    [65.8, 84.2, 70.6],
    [62.9, 57.3, 59.1],
  ],
};

// First reading at 2026-10-23 08:00 UTC, then one reading per hour (08:00-19:00).
const BASE_TIME = Date.UTC(2026, 9, 23, 8, 0, 0);
const HOUR_MS = 60 * 60 * 1000;

function buildSeedDocuments() {
  const docs = [];
  for (const server of SERVERS) {
    CPU_READINGS[server.server_id].forEach((values, docIndex) => {
      const readings = values.map((cpu, i) => ({
        Time: new Date(BASE_TIME + (docIndex * 3 + i) * HOUR_MS),
        CpuUtil: cpu,
      }));
      docs.push({
        report_id: `SEED-${server.server_id}-${String(docIndex + 1).padStart(2, '0')}`,
        server_id: server.server_id,
        device_id: server.device_id,
        server_name: server.server_name,
        model: server.model,
        processor_vendor: server.processor_vendor,
        server_generation: server.server_generation,
        location_name: server.location_name,
        report_type: 'HOURLY_CPU_REPORT',
        metric_type: config.metricType,
        unit: 'percent',
        threshold: config.cpuThreshold,
        readings,
        timestamp: readings[0].Time,
        created_at: readings[0].Time,
        source: 'seed',
      });
    });
  }
  return docs;
}

module.exports = { buildSeedDocuments };
