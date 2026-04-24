import { fmt } from '../utils';

export default function StatsGrid({ fields }) {
  return (
    <div className="stats-grid">
      {fields.map(f => (
        <div key={f.title} className="stat-card">
          <div className="stat-title">{f.title}</div>
          {['Min', 'Avg', 'Max'].map(k => (
            <div key={k} className="stat-row">
              <span className="stat-key">{k}</span>
              <span className="stat-val">
                {f[k.toLowerCase()] != null ? fmt(f[k.toLowerCase()], f.dec ?? 1) + (f.unit ? ' ' + f.unit : '') : '—'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function calcStats(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null);
  if (!vals.length) return { min: null, avg: null, max: null };
  return {
    min: Math.min(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    max: Math.max(...vals),
  };
}
