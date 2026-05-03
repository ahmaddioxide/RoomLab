import { useState, useEffect, useCallback } from 'react';
import { Thermometer, Droplets, Home, Calendar } from 'lucide-react';
import { fetchDailyStatsRange } from '../api';

function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() { return toDateStr(new Date()); }
function nDaysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

function TempBar({ min, avg, max }) {
  if (min == null || max == null) return <span className="dst-na">—</span>;
  const range = max - min;
  const pct = range > 0 ? ((avg - min) / range) * 100 : 50;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'oklch(0.70 0.10 220)', fontSize: 11 }}>{min}°</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'oklch(0.20 0.012 55)', minWidth: 40, maxWidth: 80, position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: `calc(${Math.min(Math.max(pct, 5), 90)}% - 4px)`,
          top: -2, width: 8, height: 8, borderRadius: '50%',
          background: 'oklch(0.75 0.14 55)', border: '2px solid oklch(0.15 0.012 55)', zIndex: 1,
        }} title={`Avg: ${avg}°C`} />
        <div style={{ width: '100%', height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, oklch(0.62 0.10 220), oklch(0.75 0.14 55), oklch(0.68 0.14 35))' }} />
      </div>
      <span style={{ color: 'oklch(0.75 0.14 35)', fontSize: 11 }}>{max}°</span>
    </div>
  );
}

const PRESETS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 180 },
  { label: '1yr', days: 365 },
];

export default function DailyStatsTable({ table, showOccupancy = true }) {
  const [startDate, setStartDate] = useState(nDaysAgoStr(29));
  const [endDate, setEndDate]     = useState(todayStr());
  const [stats, setStats]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [activePreset, setActivePreset] = useState('30d');

  const fetchStats = useCallback(async (start, end) => {
    if (!table) return;
    setLoading(true);
    try {
      const resp = await fetchDailyStatsRange(table, start, end);
      setStats(resp.data || []);
    } catch (_) {
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [table]);

  // Initial load
  useEffect(() => { fetchStats(nDaysAgoStr(29), todayStr()); }, [fetchStats]);

  function applyPreset(days, label) {
    const start = nDaysAgoStr(days - 1);
    const end = todayStr();
    setStartDate(start);
    setEndDate(end);
    setActivePreset(label);
    fetchStats(start, end);
  }

  function applyCustomRange(start, end) {
    if (!start || !end || start > end) return;
    setActivePreset(null);
    fetchStats(start, end);
  }

  return (
    <div className="dst-wrap">
      <div className="dst-header">
        <div>
          <span className="section-title" style={{ marginBottom: 0 }}>Day-by-Day Stats</span>
          <div className="dst-sub">Max · Avg · Min temperature per day</div>
        </div>

        <div className="dst-controls">
          {/* Preset buttons */}
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

          {/* Custom date range */}
          <div className="dst-date-range">
            <Calendar size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            <input
              type="date"
              className="day-picker-input"
              value={startDate}
              max={endDate}
              onChange={e => setStartDate(e.target.value)}
              onBlur={e => applyCustomRange(e.target.value, endDate)}
            />
            <span className="day-picker-vs">–</span>
            <input
              type="date"
              className="day-picker-input"
              value={endDate}
              max={todayStr()}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              onBlur={e => applyCustomRange(startDate, e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '24px 16px', color: 'var(--text-faint)', fontSize: 13 }}>Loading…</div>
      ) : !stats.length ? (
        <div style={{ padding: '24px 16px', color: 'var(--text-faint)', fontSize: 13 }}>No data for this range</div>
      ) : (
        <div className="dst-table-wrap">
          <table className="dst-table">
            <thead>
              <tr>
                <th>Date</th>
                <th><Thermometer size={12} style={{ display: 'inline', marginRight: 3 }} />Max</th>
                <th>Avg</th>
                <th>Min</th>
                <th><Droplets size={12} style={{ display: 'inline', marginRight: 3 }} />Hum</th>
                {showOccupancy && <th><Home size={12} style={{ display: 'inline', marginRight: 3 }} />Home hrs</th>}
                {showOccupancy && <th>Desk hrs</th>}
                <th>Range</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.date}>
                  <td className="dst-date">{formatDate(row.date)}</td>
                  <td style={{ color: 'oklch(0.75 0.14 35)', fontWeight: 600 }}>
                    {row.max_temp != null ? `${row.max_temp}°C` : <span className="dst-na">—</span>}
                  </td>
                  <td>{row.avg_temp != null ? `${row.avg_temp}°C` : <span className="dst-na">—</span>}</td>
                  <td style={{ color: 'oklch(0.70 0.10 220)' }}>
                    {row.min_temp != null ? `${row.min_temp}°C` : <span className="dst-na">—</span>}
                  </td>
                  <td>{row.avg_humidity != null ? `${row.avg_humidity}%` : <span className="dst-na">—</span>}</td>
                  {showOccupancy && (
                    <td style={{ color: row.home_hours === 24 ? 'oklch(0.70 0.11 55)' : undefined }}>
                      {row.home_hours != null
                        ? row.home_hours === 24
                          ? <span title="May indicate stuck is_home sensor">⚠ 24h</span>
                          : `${row.home_hours}h`
                        : <span className="dst-na">—</span>}
                    </td>
                  )}
                  {showOccupancy && (
                    <td>
                      {row.motion_hours != null
                        ? `${row.motion_hours}h`
                        : <span className="dst-na">—</span>}
                    </td>
                  )}
                  <td><TempBar min={row.min_temp} avg={row.avg_temp} max={row.max_temp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dst-foot">{stats.length} day{stats.length !== 1 ? 's' : ''} shown</div>
        </div>
      )}
    </div>
  );
}
