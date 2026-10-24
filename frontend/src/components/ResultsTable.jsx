import StatusBadge, { MetricValue } from './StatusBadge.jsx';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

export default function ResultsTable({ results }) {
  return (
    <section className="panel" aria-labelledby="results-heading">
      <h2 id="results-heading">
        Aggregated Results <span className="muted small">(collection: result)</span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Server</th>
              <th scope="col">Metric</th>
              <th scope="col">Average</th>
              <th scope="col">Minimum</th>
              <th scope="col">Maximum</th>
              <th scope="col">Threshold</th>
              <th scope="col">Readings</th>
              <th scope="col">Status</th>
              <th scope="col">Error Reason</th>
              <th scope="col">Calculated At</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr>
                <td colSpan={10} className="muted">No result documents.</td>
              </tr>
            )}
            {results.map((r) => (
              <tr key={r.server_id}>
                <th scope="row">
                  {r.server_name}
                  <div className="muted small">{r.server_id}</div>
                </th>
                <td>{r.metric_type}</td>
                <td><MetricValue value={r.avg_metric_value} threshold={r.threshold} /></td>
                <td><MetricValue value={r.min_metric_value} threshold={r.threshold} /></td>
                <td><MetricValue value={r.max_metric_value} threshold={r.threshold} /></td>
                <td>{r.threshold}%</td>
                <td>{r.reading_count}</td>
                <td><StatusBadge status={r.health_status} /></td>
                <td className="reason-cell">{r.error_reason || '—'}</td>
                <td className="small">{fmt(r.calculated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
