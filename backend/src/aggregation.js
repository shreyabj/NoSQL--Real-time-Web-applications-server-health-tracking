const config = require('./config');
const { getDb } = require('./db');

/*
 * Aggregation pipeline: input -> result
 *
 *  $match   keep CPU utilization documents
 *  $unwind  one document per hourly reading
 *  $match   ignore malformed readings
 *  $group   per server: avg / min / max / count / readings at-or-above threshold
 *  $set     round values to 2 decimals
 *  $project shape the result document, derive status + error_reason
 *  $merge   upsert into "result" keyed on server_id (no duplicates on re-run)
 *
 * Validation rules (threshold stored on each input document, default 80%):
 *  HEALTHY  : max < threshold  (so every reading and the average are below it)
 *  WARNING  : max >= threshold but average < threshold
 *  CRITICAL : average >= threshold
 *  status   : true only when HEALTHY (boolean, as in output_schema.py)
 */
function buildPipeline() {
  return [
    { $match: { metric_type: config.metricType } },
    { $unwind: '$readings' },
    { $match: { 'readings.CpuUtil': { $type: 'number' } } },
    {
      $group: {
        _id: '$server_id',
        device_id: { $first: '$device_id' },
        server_name: { $first: '$server_name' },
        metric_type: { $first: '$metric_type' },
        threshold: { $max: '$threshold' },
        avg_metric_value: { $avg: '$readings.CpuUtil' },
        min_metric_value: { $min: '$readings.CpuUtil' },
        max_metric_value: { $max: '$readings.CpuUtil' },
        max_metric_time: {
          $top: { sortBy: { 'readings.CpuUtil': -1, 'readings.Time': 1 }, output: '$readings.Time' },
        },
        reading_count: { $sum: 1 },
        readings_above_threshold: {
          $sum: { $cond: [{ $gte: ['$readings.CpuUtil', '$threshold'] }, 1, 0] },
        },
        input_document_ids: { $addToSet: '$_id' },
        first_reading_time: { $min: '$readings.Time' },
        last_reading_time: { $max: '$readings.Time' },
      },
    },
    {
      $set: {
        avg_metric_value: { $round: ['$avg_metric_value', 2] },
        min_metric_value: { $round: ['$min_metric_value', 2] },
        max_metric_value: { $round: ['$max_metric_value', 2] },
      },
    },
    {
      $project: {
        _id: 0,
        server_id: '$_id',
        device_id: 1,
        server_name: 1,
        metric_type: 1,
        unit: 'percent',
        avg_metric_value: 1,
        min_metric_value: 1,
        max_metric_value: 1,
        max_metric_time: 1,
        threshold: 1,
        reading_count: 1,
        readings_above_threshold: 1,
        input_document_count: { $size: '$input_document_ids' },
        first_reading_time: 1,
        last_reading_time: 1,
        health_status: {
          $switch: {
            branches: [
              { case: { $gte: ['$avg_metric_value', '$threshold'] }, then: 'CRITICAL' },
              { case: { $gte: ['$max_metric_value', '$threshold'] }, then: 'WARNING' },
            ],
            default: 'HEALTHY',
          },
        },
        status: { $lt: ['$max_metric_value', '$threshold'] },
        error_reason: {
          $switch: {
            branches: [
              {
                case: { $gte: ['$avg_metric_value', '$threshold'] },
                then: {
                  $concat: [
                    'Average CPU ', { $toString: '$avg_metric_value' }, '% is at or above the ',
                    { $toString: '$threshold' }, '% threshold; ',
                    { $toString: '$readings_above_threshold' }, ' of ', { $toString: '$reading_count' },
                    ' readings breached (peak ', { $toString: '$max_metric_value' }, '%)',
                  ],
                },
              },
              {
                case: { $gte: ['$max_metric_value', '$threshold'] },
                then: {
                  $concat: [
                    { $toString: '$readings_above_threshold' }, ' of ', { $toString: '$reading_count' },
                    ' readings at or above the ', { $toString: '$threshold' },
                    '% threshold (peak ', { $toString: '$max_metric_value' }, '%)',
                  ],
                },
              },
            ],
            default: null,
          },
        },
        calculated_at: '$$NOW',
      },
    },
    {
      $merge: {
        into: config.collections.result,
        on: 'server_id',
        whenMatched: 'replace',
        whenNotMatched: 'insert',
      },
    },
  ];
}

async function runAggregation() {
  const db = getDb();
  const pipeline = buildPipeline();
  try {
    await db.collection(config.collections.input).aggregate(pipeline).toArray();
  } catch (err) {
    // Two concurrent first-time merges can race on the unique index; retry once.
    if (err && err.code === 11000) {
      await db.collection(config.collections.input).aggregate(pipeline).toArray();
    } else {
      throw err;
    }
  }
  return getResults();
}

async function getResults() {
  return getDb()
    .collection(config.collections.result)
    .find({}, { projection: { _id: 0 } })
    .sort({ server_id: 1 })
    .toArray();
}

function summarize(results) {
  const healthy = results.filter((r) => r.health_status === 'HEALTHY').length;
  return {
    total_servers: results.length,
    healthy,
    unhealthy: results.length - healthy,
    warning: results.filter((r) => r.health_status === 'WARNING').length,
    critical: results.filter((r) => r.health_status === 'CRITICAL').length,
  };
}

module.exports = { buildPipeline, runAggregation, getResults, summarize };
