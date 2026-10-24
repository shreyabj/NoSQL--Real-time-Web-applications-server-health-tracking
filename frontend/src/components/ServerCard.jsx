import StatusBadge, { MetricValue } from './StatusBadge.jsx';

export default function ServerCard({ result, highlighted }) {
  const r = result;
  const pct = Math.min(100, Math.max(0, r.avg_metric_value));
  return (
    <article
      className={`server-card status-${r.health_status.toLowerCase()} ${highlighted ? 'flash' : ''}`}
      aria-label={`${r.server_name} is ${r.health_status}`}
    >
      <div className="card-head">
        <div>
          <h3>{r.server_name}</h3>
          <span className="muted small">
            {r.server_id} · {r.metric_type}
          </span>
        </div>
        <StatusBadge status={r.health_status} />
      </div>

      <div className="meter" role="img" aria-label={`Average CPU ${r.avg_metric_value}% of ${r.threshold}% threshold`}>
        <div className={`meter-fill ${r.avg_metric_value >= r.threshold ? 'bad' : 'ok'}`} style={{ width: `${pct}%` }} />
        <div className="meter-threshold" style={{ left: `${r.threshold}%` }} />
      </div>

      <dl className="metrics">
        <div>
          <dt>Average</dt>
          <dd><MetricValue value={r.avg_metric_value} threshold={r.threshold} /></dd>
        </div>
        <div>
          <dt>Minimum</dt>
          <dd><MetricValue value={r.min_metric_value} threshold={r.threshold} /></dd>
        </div>
        <div>
          <dt>Maximum</dt>
          <dd><MetricValue value={r.max_metric_value} threshold={r.threshold} /></dd>
        </div>
        <div>
          <dt>Threshold</dt>
          <dd>{r.threshold}%</dd>
        </div>
        <div>
          <dt>Readings</dt>
          <dd>{r.reading_count}</dd>
        </div>
        <div>
          <dt>Breaches</dt>
          <dd className={r.readings_above_threshold > 0 ? 'val-bad' : 'val-ok'}>{r.readings_above_threshold}</dd>
        </div>
      </dl>

      <p className={`reason ${r.status ? 'ok' : 'bad'}`}>
        {r.error_reason || 'All readings are below the threshold.'}
      </p>
    </article>
  );
}
