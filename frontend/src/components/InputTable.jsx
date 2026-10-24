const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

export default function InputTable({ data }) {
  const docs = data?.documents || [];
  return (
    <section className="panel" aria-labelledby="input-heading">
      <h2 id="input-heading">
        Latest Input Documents <span className="muted small">(collection: input, newest 15)</span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Report ID</th>
              <th scope="col">Server</th>
              <th scope="col">Source</th>
              <th scope="col">Timestamp</th>
              <th scope="col">CPU Readings (%)</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No input documents.</td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d.report_id}>
                <td className="mono small">{d.report_id}</td>
                <td>{d.server_name}</td>
                <td>{d.source}</td>
                <td className="small">{fmt(d.timestamp)}</td>
                <td>
                  {d.readings.map((r, i) => (
                    <span key={i} className={`chip ${r.CpuUtil >= d.threshold ? 'bad' : 'ok'}`}>
                      {r.CpuUtil}
                      <span className="sr-label">{r.CpuUtil >= d.threshold ? ' high' : ' normal'}</span>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
