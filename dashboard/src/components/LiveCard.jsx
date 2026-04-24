import { fmt } from '../utils';

export default function LiveCard({ label, value, unit, meta, children, style }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div>
        <span className="card-value" style={style}>{value ?? '—'}</span>
        {unit && <span className="card-unit">{unit}</span>}
      </div>
      {meta && <div className="card-meta"><span>{meta}</span></div>}
      {children}
    </div>
  );
}

export function TrendBadge({ value, unit = '°C/hr', threshold = 0.1 }) {
  if (value == null) return <div className="card-meta"><span className="trend-indicator trend-stable">—</span></div>;
  const abs = Math.abs(value);
  let arrow, cls;
  if (abs < threshold) { arrow = '→'; cls = 'trend-stable'; }
  else if (value > 0) { arrow = '↑'; cls = 'trend-up'; }
  else { arrow = '↓'; cls = 'trend-down'; }
  return (
    <div className="card-meta">
      <span className={`trend-indicator ${cls}`}>{arrow} {value > 0 ? '+' : ''}{value.toFixed(1)} {unit}</span>
    </div>
  );
}

export function AqiDisplay({ score, info, rawValue }) {
  return (
    <>
      <div className="aqi-bar-wrap">
        <div className="aqi-bar-fill" style={{ width: score != null ? score + '%' : '0%', background: info.color }} />
      </div>
      <div className="card-meta">
        <span
          className={`badge ${info.badgeCls}`}
          style={{ color: info.color, borderColor: info.color + '4d', background: info.color + '26' }}
        >
          {info.label}
        </span>
      </div>
      <div className="aqi-raw">{rawValue != null ? `Raw: ${rawValue}` : ''}</div>
    </>
  );
}
