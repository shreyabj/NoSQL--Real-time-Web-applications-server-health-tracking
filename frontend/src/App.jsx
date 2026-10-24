import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import StatCards from './components/StatCards.jsx';
import ServerCard from './components/ServerCard.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import ReadingForm from './components/ReadingForm.jsx';
import InputTable from './components/InputTable.jsx';

const POLL_MS = 10000;

export default function App() {
  const [health, setHealth] = useState(null);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [inputData, setInputData] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // Load everything the dashboard shows from the backend API.
  const load = useCallback(async () => {
    try {
      const healthRes = await api.health().catch((e) => e.body || { database: 'disconnected' });
      setHealth(healthRes);
      const [res, inp] = await Promise.all([api.results(), api.input(15)]);
      setResults(res.results);
      setSummary(res.summary);
      setInputData(inp);
      setError('');
      setLastUpdated(new Date());
    } catch (e) {
      setError(`Could not load data from the backend: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const handleSubmitReading = async (payload) => {
    const res = await api.addReading(payload);
    setHighlight(payload.server_id);
    setTimeout(() => setHighlight(null), 2500);
    await load();
    return res;
  };

  const runAction = async (label, fn) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fn();
      setNotice({ type: 'ok', text: res.message || `${label} done` });
      await load();
    } catch (e) {
      setNotice({ type: 'error', text: `${label} failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const connected = health && health.database === 'connected';

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Real-Time Web Application Server Health Monitoring</h1>
          <p className="subtitle">
            MongoDB database <code>{health?.database_name || 'server_health_monitoring'}</code> · collections{' '}
            <code>input</code> &amp; <code>result</code> · CPU threshold {health?.cpu_threshold ?? 80}%
          </p>
        </div>
        <div className={`conn ${connected ? 'ok' : 'bad'}`} role="status" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {health === null ? 'Checking database…' : connected ? 'MongoDB Connected' : 'MongoDB Disconnected'}
        </div>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <StatCards
        totalServers={summary?.total_servers}
        inputCount={inputData?.input_document_count}
        readingCount={inputData?.reading_count}
        healthy={summary?.healthy}
        unhealthy={summary?.unhealthy}
      />

      <section aria-labelledby="servers-heading">
        <h2 id="servers-heading">Server Health</h2>
        <div className="server-grid">
          {results.length === 0 && <p className="muted">No results yet. Seed the sample data to begin.</p>}
          {results.map((r) => (
            <ServerCard key={r.server_id} result={r} highlighted={highlight === r.server_id} />
          ))}
        </div>
      </section>

      <div className="two-col">
        <ReadingForm onSubmit={handleSubmitReading} />

        <section className="panel" aria-labelledby="actions-heading">
          <h2 id="actions-heading">Demo Actions</h2>
          <p className="muted">
            Aggregation runs automatically after every new reading. These buttons are for demonstrations.
          </p>
          <div className="btn-row">
            <button type="button" disabled={busy} onClick={() => runAction('Aggregation', api.aggregate)}>
              Run aggregation now
            </button>
            <button type="button" disabled={busy} onClick={() => runAction('Seed', () => api.seed(false))}>
              Seed sample data
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Delete all input/result documents and restore the 12 sample documents?')) {
                  runAction('Reset', () => api.seed(true));
                }
              }}
            >
              Reset sample data
            </button>
          </div>
          {notice && (
            <p className={`notice ${notice.type}`} role="status" aria-live="polite">
              {notice.text}
            </p>
          )}
          <p className="muted small">
            Last refreshed: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'} (auto-refresh every{' '}
            {POLL_MS / 1000}s)
          </p>
        </section>
      </div>

      <ResultsTable results={results} />
      <InputTable data={inputData} />

      <footer className="footer">
        React + Vite · Node.js + Express · MongoDB (Docker) — data served by the backend API
      </footer>
    </div>
  );
}
