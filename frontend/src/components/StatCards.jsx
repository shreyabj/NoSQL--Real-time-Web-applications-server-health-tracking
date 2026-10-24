const show = (v) => (v === undefined || v === null ? '—' : v);

export default function StatCards({ totalServers, inputCount, readingCount, healthy, unhealthy }) {
  const items = [
    { label: 'Total Servers', value: totalServers },
    { label: 'Input Documents', value: inputCount },
    { label: 'Individual Readings', value: readingCount },
    { label: 'Healthy Servers', value: healthy, tone: 'ok' },
    { label: 'Unhealthy Servers', value: unhealthy, tone: 'bad' },
  ];
  return (
    <section className="stats" aria-label="Summary statistics">
      {items.map((it) => (
        <div key={it.label} className={`stat ${it.tone || ''}`}>
          <div className="stat-value">{show(it.value)}</div>
          <div className="stat-label">{it.label}</div>
        </div>
      ))}
    </section>
  );
}
