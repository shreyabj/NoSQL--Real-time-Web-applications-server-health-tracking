import { useState } from 'react';

const SERVERS = [
  { id: 'SRV-01', name: 'Server-01' },
  { id: 'SRV-02', name: 'Server-02' },
  { id: 'SRV-03', name: 'Server-03' },
];

export default function ReadingForm({ onSubmit }) {
  const [serverId, setServerId] = useState('SRV-01');
  const [cpu, setCpu] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const send = async (payload) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await onSubmit(payload);
      const r = res.server_result;
      setMsg({
        type: 'ok',
        text: `${res.message}. ${r ? `${r.server_name} is now ${r.health_status} (avg ${r.avg_metric_value}%, max ${r.max_metric_value}%).` : ''}`,
      });
      setCpu('');
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = Number(cpu);
    if (cpu === '' || !Number.isFinite(value) || value < 0 || value > 100) {
      setMsg({ type: 'error', text: 'Enter a CPU utilization between 0 and 100.' });
      return;
    }
    send({ server_id: serverId, cpu_util: value });
  };

  const simulate = () => {
    const server = SERVERS[Math.floor(Math.random() * SERVERS.length)];
    const value = Math.round((20 + Math.random() * 79) * 10) / 10; // 20.0 - 99.0
    setServerId(server.id);
    send({ server_id: server.id, cpu_util: value });
  };

  return (
    <section className="panel" aria-labelledby="form-heading">
      <h2 id="form-heading">Insert New CPU Reading</h2>
      <form onSubmit={handleSubmit} className="form" noValidate>
        <label htmlFor="server">Server</label>
        <select id="server" value={serverId} onChange={(e) => setServerId(e.target.value)} disabled={busy}>
          {SERVERS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.id})
            </option>
          ))}
        </select>

        <label htmlFor="cpu">CPU utilization (%)</label>
        <input
          id="cpu"
          type="number"
          min="0"
          max="100"
          step="0.1"
          inputMode="decimal"
          placeholder="e.g. 85.5"
          value={cpu}
          onChange={(e) => setCpu(e.target.value)}
          disabled={busy}
          aria-describedby="cpu-help"
        />
        <span id="cpu-help" className="muted small">
          Readings at or above 80% are threshold violations.
        </span>

        <div className="btn-row">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Insert reading'}
          </button>
          <button type="button" className="secondary" onClick={simulate} disabled={busy}>
            Simulate random reading
          </button>
        </div>
      </form>
      {msg && (
        <p className={`notice ${msg.type}`} role={msg.type === 'error' ? 'alert' : 'status'} aria-live="polite">
          {msg.text}
        </p>
      )}
    </section>
  );
}
