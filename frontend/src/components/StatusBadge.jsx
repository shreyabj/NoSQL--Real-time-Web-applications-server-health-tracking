const ICON = { HEALTHY: '✔', WARNING: '⚠', CRITICAL: '✖' };

export default function StatusBadge({ status }) {
  const s = status || 'UNKNOWN';
  return (
    <span className={`badge badge-${s.toLowerCase()}`}>
      <span aria-hidden="true">{ICON[s] || '?'}</span> {s}
    </span>
  );
}

// Green when below threshold, red when at/above threshold.
export function MetricValue({ value, threshold }) {
  if (value === undefined || value === null) return <span>—</span>;
  const breach = value >= threshold;
  return (
    <span className={breach ? 'val-bad' : 'val-ok'}>
      {value.toFixed(2)}%<span className="sr-label"> {breach ? '(above threshold)' : '(normal)'}</span>
    </span>
  );
}
