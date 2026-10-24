// All data comes from the backend API (proxied by nginx at /api).
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const details = body && body.details ? `: ${[].concat(body.details).join('; ')}` : '';
    const err = new Error(`${(body && body.error) || `HTTP ${res.status}`}${details}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  health: () => request('/health'),
  servers: () => request('/servers'),
  input: (limit = 15) => request(`/input?limit=${limit}`),
  results: () => request('/results'),
  addReading: (payload) => request('/input', { method: 'POST', body: JSON.stringify(payload) }),
  seed: (reset = false) => request('/seed', { method: 'POST', body: JSON.stringify({ reset }) }),
  aggregate: () => request('/aggregate', { method: 'POST', body: '{}' }),
};
