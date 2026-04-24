import { fmt } from '../utils';

export default function SummaryGrid({ weekData, monthData }) {
  function tempSummary(rows) {
    const t = rows.map(r => r.temperature).filter(v => v != null);
    if (!t.length) return { avg: '—', range: 'No data' };
    const avg = t.reduce((a, b) => a + b, 0) / t.length;
    return { avg: fmt(avg) + ' °C', range: `Range: ${fmt(Math.min(...t))} – ${fmt(Math.max(...t))} °C` };
  }

  function occSummary(rows) {
    if (!rows.length) return { pct: '—', sub: 'No data' };
    const mc = rows.filter(r => r.motion).length;
    const hs = new Set(), ts = new Set();
    for (const r of rows) {
      const d = new Date(r.created_at);
      const sk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      ts.add(sk);
      if (r.motion) hs.add(sk);
    }
    return { pct: Math.round((mc / rows.length) * 100) + '%', sub: `${hs.size} of ${ts.size} hrs had activity` };
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const wk = weekData.filter(r => new Date(r.created_at) >= weekAgo);
  const wTemp = tempSummary(wk), mTemp = tempSummary(monthData);
  const wOcc = occSummary(wk), mOcc = occSummary(monthData);

  return (
    <div className="summary-grid">
      <div className="summary-card"><div className="summary-icon" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>🌡</div><div className="summary-body"><div className="summary-label">This Week Avg Temp</div><div className="summary-value">{wTemp.avg}</div><div className="summary-sub">{wTemp.range}</div></div></div>
      <div className="summary-card"><div className="summary-icon" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>📅</div><div className="summary-body"><div className="summary-label">This Month Avg Temp</div><div className="summary-value">{mTemp.avg}</div><div className="summary-sub">{mTemp.range}</div></div></div>
      <div className="summary-card"><div className="summary-icon" style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf' }}>🏠</div><div className="summary-body"><div className="summary-label">Weekly Occupancy</div><div className="summary-value">{wOcc.pct}</div><div className="summary-sub">{wOcc.sub}</div></div></div>
      <div className="summary-card"><div className="summary-icon" style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf' }}>📊</div><div className="summary-body"><div className="summary-label">Monthly Occupancy</div><div className="summary-value">{mOcc.pct}</div><div className="summary-sub">{mOcc.sub}</div></div></div>
    </div>
  );
}
