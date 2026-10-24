const { findServer } = require('./servers');

// Validate a reading submitted from the dashboard.
// Returns { value } on success or { errors: [...] } on failure.
function validateReading(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object'] };
  }

  const server = typeof body.server_id === 'string' ? findServer(body.server_id.trim()) : null;
  if (!server) errors.push('server_id must be one of SRV-01, SRV-02, SRV-03');

  let cpu = body.cpu_util;
  if (typeof cpu === 'string' && cpu.trim() !== '') cpu = Number(cpu);
  if (typeof cpu !== 'number' || !Number.isFinite(cpu)) {
    errors.push('cpu_util must be a number');
  } else if (cpu < 0 || cpu > 100) {
    errors.push('cpu_util must be between 0 and 100 (percent)');
  }

  let time = new Date();
  if (body.timestamp !== undefined && body.timestamp !== null && body.timestamp !== '') {
    time = new Date(body.timestamp);
    if (Number.isNaN(time.getTime())) {
      errors.push('timestamp must be a valid ISO-8601 date');
    } else if (time.getTime() > Date.now() + 5 * 60 * 1000) {
      errors.push('timestamp cannot be in the future');
    } else if (time.getUTCFullYear() < 2000) {
      errors.push('timestamp is too old');
    }
  }

  if (errors.length) return { errors };
  return { value: { server, cpuUtil: Math.round(cpu * 100) / 100, time } };
}

module.exports = { validateReading };
