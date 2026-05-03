import { fmt } from '../utils';
import { Thermometer, CalendarDays, Home, BarChart3 } from 'lucide-react';

export default function SummaryGrid({ weekData, monthData, showOccupancy = true, useIsHome = false }) {
  function tempSummary(rows) {
    const t = rows.map(r => r.temperature).filter(v => v != null);
    if (!t.length) return { avg: '—', range: 'No data' };
    const avg = t.reduce((a, b) => a + b, 0) / t.length;
    return { avg: fmt(avg) + ' °C', range: `Range: ${fmt(Math.min(...t))} – ${fmt(Math.max(...t))} °C` };
  }

  function occSummary(rows) {
    if (!rows.length) return { pct: '—', sub: 'No data' };
    // Use is_home with staleness validation if useIsHome, else use motion
    const field = useIsHome ? 'is_home' : 'motion';
    const mc = rows.filter(r => r[field]).length;
    const hs = new Set(), ts = new Set();
    for (const r of rows) {
      const d = new Date(r.created_at);
      const sk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      ts.add(sk);
      if (r[field]) hs.add(sk);
    }
    // Staleness check: if is_home is used and > 20hrs straight are occupied, likely stuck sensor
    const staleness = useIsHome && hs.size > 20
      ? ' (sensor may be stuck)' : '';
    return { pct: Math.round((mc / rows.length) * 100) + '%', sub: `${hs.size} of ${ts.size} hrs had activity${staleness}` };
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const wk = weekData.filter(r => new Date(r.created_at) >= weekAgo);
  const wTemp = tempSummary(wk), mTemp = tempSummary(monthData);
  const wOcc = occSummary(wk), mOcc = occSummary(monthData);

  return (
    <div className={`summary-grid${showOccupancy ? '' : ' summary-grid-2col'}`}>
      <div className="summary-card"><div className="summary-icon" style={{ background: 'oklch(0.75 0.14 55 / 0.15)', color: 'oklch(0.75 0.14 55)' }}><Thermometer size={20} /></div><div className="summary-body"><div className="summary-label">This Week Avg Temp</div><div className="summary-value">{wTemp.avg}</div><div className="summary-sub">{wTemp.range}</div></div></div>
      <div className="summary-card"><div className="summary-icon" style={{ background: 'oklch(0.75 0.14 55 / 0.15)', color: 'oklch(0.75 0.14 55)' }}><CalendarDays size={20} /></div><div className="summary-body"><div className="summary-label">This Month Avg Temp</div><div className="summary-value">{mTemp.avg}</div><div className="summary-sub">{mTemp.range}</div></div></div>
      {showOccupancy && <>
        <div className="summary-card"><div className="summary-icon" style={{ background: 'oklch(0.72 0.12 70 / 0.15)', color: 'oklch(0.72 0.12 70)' }}><Home size={20} /></div><div className="summary-body"><div className="summary-label">Weekly Occupancy</div><div className="summary-value">{wOcc.pct}</div><div className="summary-sub">{wOcc.sub}</div></div></div>
        <div className="summary-card"><div className="summary-icon" style={{ background: 'oklch(0.72 0.12 70 / 0.15)', color: 'oklch(0.72 0.12 70)' }}><BarChart3 size={20} /></div><div className="summary-body"><div className="summary-label">Monthly Occupancy</div><div className="summary-value">{mOcc.pct}</div><div className="summary-sub">{mOcc.sub}</div></div></div>
      </>}
    </div>
  );
}
