import { useState, useEffect, useCallback } from 'react';
import { Thermometer, Droplets, Calendar, Home, Monitor } from 'lucide-react';
import { fetchDailyStatsRange } from '../api';

function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() { return toDateStr(new Date()); }
function nDaysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); }
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

function DeltaBadge({ v1, v2, unit = '°C', inverted = false }) {
  if (v1 == null || v2 == null) return <span className="dst-na">—</span>;
  const d = v2 - v1;
  const thresh = unit === '°C' ? 0.2 : 1;
  if (Math.abs(d) < thresh) return <span className="cdt-delta-same">≈</span>;
  const pos = inverted ? d < 0 : d > 0;
  return (
    <span className={pos ? 'cdt-delta-up' : 'cdt-delta-down'}>
      {d > 0 ? '+' : ''}{d.toFixed(unit === '°C' ? 1 : 0)}{unit}
    </span>
  );
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 180 },
  { label: '1yr', days: 365 },
];

export default function CombinedDailyTable() {
  const [startDate, setStartDate] = useState(nDaysAgoStr(29));
  const [endDate, setEndDate]     = useState(todayStr());
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [activePreset, setActivePreset] = useState('30d');

  const fetchRows = useCallback(async (start, end) => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetchDailyStatsRange('room_monitor', start, end),
        fetchDailyStatsRange('esp32_monitor', start, end),
      ]);
      // Merge by date
      const map = new Map();
      for (const r of (r1.data || [])) map.set(r.date, { date: r.date, r1: r });
      for (const r of (r2.data || [])) {
        if (!map.has(r.date)) map.set(r.date, { date: r.date });
        map.get(r.date).r2 = r;
      }
      setRows([...map.values()].sort((a, b) => b.date.localeCompare(a.date)));
    } catch (_) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(nDaysAgoStr(29), todayStr()); }, [fetchRows]);

  function applyPreset(days, label) {
    const start = nDaysAgoStr(days - 1);
    const end = todayStr();
    setStartDate(start); setEndDate(end); setActivePreset(label);
    fetchRows(start, end);
  }

  function applyCustomRange(start, end) {
    if (!start || !end || start > end) return;
    setActivePreset(null);
    fetchRows(start, end);
  }

  return (
    <div className="dst-wrap">
      <div className="dst-header">
        <div>
          <span className="section-title" style={{ marginBottom: 0 }}>Daily Comparison</span>
          <div className="dst-sub">Room 1 vs Room 2 · per day</div>
        </div>
        <div className="dst-controls">
          <div className="dst-presets">
            {PRESETS.map(p => (
              <button
                key={p.label}
                className={`dst-preset-btn${activePreset === p.label ? ' active' : ''}`}
                onClick={() => applyPreset(p.days, p.label)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="dst-date-range">
            <Calendar size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            <input type="date" className="day-picker-input" value={startDate} max={endDate}
              onChange={e => setStartDate(e.target.value)}
              onBlur={e => applyCustomRange(e.target.value, endDate)} />
            <span className="day-picker-vs">–</span>
            <input type="date" className="day-picker-input" value={endDate} max={todayStr()} min={startDate}
              onChange={e => setEndDate(e.target.value)}
              onBlur={e => applyCustomRange(startDate, e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '20px 16px', color: 'var(--text-faint)', fontSize: 13 }}>Loading…</div>
      ) : !rows.length ? (
        <div style={{ padding: '20px 16px', color: 'var(--text-faint)', fontSize: 13 }}>No data for this range</div>
      ) : (
        <div className="dst-table-wrap">
          <table className="dst-table cdt-table">
            <thead>
              <tr>
                <th rowSpan={2}>Date</th>
                <th colSpan={3} className="cdt-group-header cdt-r1">
                  <Thermometer size={11} style={{ display: 'inline', marginRight: 3 }} />Temperature
                </th>
                <th colSpan={3} className="cdt-group-header cdt-r1">
                  <Droplets size={11} style={{ display: 'inline', marginRight: 3 }} />Humidity
                </th>
                <th colSpan={2} className="cdt-group-header cdt-r2occ">
                  Room 2 Occupancy
                </th>
              </tr>
              <tr>
                <th className="cdt-sub-r1">R1</th>
                <th className="cdt-sub-r2">R2</th>
                <th>Δ</th>
                <th className="cdt-sub-r1">R1</th>
                <th className="cdt-sub-r2">R2</th>
                <th>Δ</th>
                <th><Home size={11} style={{ display: 'inline' }} /></th>
                <th><Monitor size={11} style={{ display: 'inline' }} /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ date, r1, r2 }) => (
                <tr key={date}>
                  <td className="dst-date">{formatDate(date)}</td>
                  {/* Temperature */}
                  <td className="cdt-sub-r1">
                    {r1?.avg_temp != null ? (
                      <span>
                        <span style={{ color: 'oklch(0.75 0.14 55)', fontWeight: 600 }}>{r1.avg_temp}°</span>
                        <span className="cdt-minmax"> {r1.min_temp}–{r1.max_temp}</span>
                      </span>
                    ) : <span className="dst-na">—</span>}
                  </td>
                  <td className="cdt-sub-r2">
                    {r2?.avg_temp != null ? (
                      <span>
                        <span style={{ color: 'oklch(0.68 0.10 155)', fontWeight: 600 }}>{r2.avg_temp}°</span>
                        <span className="cdt-minmax"> {r2.min_temp}–{r2.max_temp}</span>
                      </span>
                    ) : <span className="dst-na">—</span>}
                  </td>
                  <td><DeltaBadge v1={r1?.avg_temp} v2={r2?.avg_temp} unit="°C" /></td>
                  {/* Humidity */}
                  <td className="cdt-sub-r1">
                    {r1?.avg_humidity != null
                      ? <span style={{ color: 'oklch(0.70 0.10 220)' }}>{r1.avg_humidity}%</span>
                      : <span className="dst-na">—</span>}
                  </td>
                  <td className="cdt-sub-r2">
                    {r2?.avg_humidity != null
                      ? <span style={{ color: 'oklch(0.70 0.10 220)' }}>{r2.avg_humidity}%</span>
                      : <span className="dst-na">—</span>}
                  </td>
                  <td><DeltaBadge v1={r1?.avg_humidity} v2={r2?.avg_humidity} unit="%" /></td>
                  {/* R2 occupancy */}
                  <td style={{ color: r2?.home_hours === 24 ? 'oklch(0.70 0.11 55)' : 'var(--text)' }}>
                    {r2?.home_hours != null
                      ? r2.home_hours === 24 ? <span title="May be stuck">⚠ 24h</span> : `${r2.home_hours}h`
                      : <span className="dst-na">—</span>}
                  </td>
                  <td>
                    {r2?.motion_hours != null ? `${r2.motion_hours}h` : <span className="dst-na">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
