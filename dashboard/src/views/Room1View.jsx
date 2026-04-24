import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useRoomData } from '../hooks/useRoomData';
import { RANGES, ROOM_CONFIG, CHART_TOOLTIP } from '../config';
import { fmt, calcAirQuality, getAQIInfo, computeTrends, hourAmPm } from '../utils';
import LiveCard, { TrendBadge, AqiDisplay } from '../components/LiveCard';
import ComfortSection from '../components/ComfortSection';
import RangeTabs from '../components/RangeTabs';
import { ChartCard, LegendDot, TimeSeriesChart, BarChartCard, yScale, yScaleRight } from '../components/ChartCard';
import Heatmap from '../components/Heatmap';
import StatsGrid, { calcStats } from '../components/StatsGrid';
import SummaryGrid from '../components/SummaryGrid';
import DeviceStatus from '../components/DeviceStatus';
import Overlay from '../components/Overlay';

export default function Room1View() {
  const [range, setRange] = useState('6h');
  const { bucketed, rangeData, latest, insights7d, insights30d, compRows, loading } = useRoomData('room1', range);
  const cfg = ROOM_CONFIG.room1;

  const gasVal = latest?.[cfg.gasField];
  const aqiScore = calcAirQuality(gasVal);
  const aqiInfo = getAQIInfo(aqiScore);
  const recentRows = useMemo(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    return rangeData.filter(r => new Date(r.created_at).getTime() > cutoff);
  }, [rangeData]);
  const trends = useMemo(() => computeTrends(recentRows, cfg.gasField), [recentRows, cfg.gasField]);

  // Chart datasets
  const climateDS = useMemo(() => [
    { label: 'Temp', data: bucketed.filter(r => r.temperature != null).map(r => ({ x: r.created_at, y: r.temperature })), borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, yAxisID: 'y' },
    { label: 'Hum', data: bucketed.filter(r => r.humidity != null).map(r => ({ x: r.created_at, y: r.humidity })), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, yAxisID: 'y1' },
  ], [bucketed]);

  const gasDS = useMemo(() => [
    { label: 'Gas', data: bucketed.filter(r => r[cfg.gasField] != null).map(r => ({ x: r.created_at, y: r[cfg.gasField] })), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 2, fill: true, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
  ], [bucketed, cfg.gasField]);

  // Peak hours
  const peakData = useMemo(() => {
    const hours = Array.from({ length: 24 }, () => ({ motion: 0, total: 0 }));
    for (const r of insights7d) { const h = new Date(r.created_at).getHours(); hours[h].total++; if (r.motion) hours[h].motion++; }
    return hours.map(h => h.total > 0 ? Math.round((h.motion / h.total) * 100) : 0);
  }, [insights7d]);

  // Stats
  const statsFields = useMemo(() => [
    { title: 'Temperature', ...calcStats(rangeData, 'temperature'), unit: '°C', dec: 1 },
    { title: 'Humidity', ...calcStats(rangeData, 'humidity'), unit: '%', dec: 1 },
    { title: 'Gas Level', ...calcStats(rangeData, cfg.gasField), unit: '', dec: 0 },
  ], [rangeData, cfg.gasField]);

  if (loading && !latest) return <Overlay title="Loading" message="Fetching Room 1 data…" visible />;

  return (
    <div className="view active">
      <div className="section-header">
        <div><div className="section-title">Room 1 — <span style={{ color: 'var(--r1)' }}>ESP8266</span></div><div className="section-sub">DHT11 · MQ2 · Buzzer</div></div>
      </div>
      <DeviceStatus room="room1" latest={latest} />

      <div className="live-grid live-grid-4">
        <LiveCard label="Temperature" value={fmt(latest?.temperature)} unit="°C">
          <TrendBadge value={trends.temp} unit="°C/hr" threshold={0.1} />
        </LiveCard>
        <LiveCard label="Humidity" value={fmt(latest?.humidity)} unit="%">
          <TrendBadge value={trends.hum} unit="%/hr" threshold={0.5} />
        </LiveCard>
        <LiveCard label="Air Quality" value={aqiScore ?? '—'} unit="/100">
          <AqiDisplay score={aqiScore} info={aqiInfo} rawValue={gasVal} />
        </LiveCard>
        <LiveCard label="Motion" value="Sensor offline" style={{ fontSize: 22, color: 'var(--text-faint)' }}>
          <div className="card-meta"><span className="badge" style={{ background: 'rgba(74,82,96,0.2)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>Disabled</span></div>
        </LiveCard>
      </div>

      <ComfortSection temperature={latest?.temperature} humidity={latest?.humidity} />

      <div className="range-bar">
        <RangeTabs current={range} onChange={setRange} />
        <div className="range-meta">Showing {RANGES[range].label}</div>
      </div>

      <div className="charts">
        <ChartCard title="Temperature & Humidity" legend={<><LegendDot color="var(--temp)" label="Temp °C" /><LegendDot color="var(--humidity)" label="Humidity %" /></>}>
          <TimeSeriesChart datasets={climateDS} scales={{ y: yScale('#fb923c'), y1: yScaleRight('#38bdf8') }} />
        </ChartCard>
        <ComparisonSection compRows={compRows} />
        <ChartCard title="Gas Level" legend={<LegendDot color="var(--gas)" label="level" />}>
          <TimeSeriesChart datasets={gasDS} scales={{ y: yScale('#7d8590') }} />
        </ChartCard>
      </div>

      <div className="section-title">Insights</div>
      <div className="insights-grid">
        <ChartCard title="Room Occupancy — Last 7 Days">
          <Heatmap rows={insights7d} accentRgb={cfg.accent} />
        </ChartCard>
        <ChartCard title="Peak Activity Hours">
          <BarChartCard labels={Array.from({ length: 24 }, (_, i) => hourAmPm(i))} data={peakData} accentRgb={cfg.accent} />
        </ChartCard>
      </div>

      <div className="section-title">Summary</div>
      <SummaryGrid weekData={insights7d} monthData={insights30d} />

      <StatsGrid fields={statsFields} />
    </div>
  );
}

function ComparisonSection({ compRows }) {
  const [mode, setMode] = useState('both');

  const datasets = useMemo(() => {
    if (!compRows.length) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const today = compRows.filter(r => new Date(r.created_at) >= todayStart);
    const yesterday = compRows.filter(r => { const d = new Date(r.created_at); return d >= yesterdayStart && d < todayStart; });
    function toHD(rows, f) { return rows.filter(r => r[f] != null).map(r => { const d = new Date(r.created_at); return { x: d.getHours() + d.getMinutes() / 60, y: r[f] }; }); }
    const ds = [], showT = mode === 'both' || mode === 'temp', showH = mode === 'both' || mode === 'hum';
    if (showT) {
      ds.push({ label: 'Y Temp', data: toHD(yesterday, 'temperature'), borderColor: 'rgba(251,146,60,0.45)', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0.3, yAxisID: 'y', order: 2 });
      ds.push({ label: 'T Temp', data: toHD(today, 'temperature'), borderColor: '#fb923c', borderWidth: 2.5, pointRadius: 1, pointHoverRadius: 4, tension: 0.3, yAxisID: 'y', order: 1 });
    }
    if (showH) {
      const yid = showT ? 'y1' : 'y';
      ds.push({ label: 'Y Hum', data: toHD(yesterday, 'humidity'), borderColor: 'rgba(56,189,248,0.45)', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0.3, yAxisID: yid, order: 2 });
      ds.push({ label: 'T Hum', data: toHD(today, 'humidity'), borderColor: '#38bdf8', borderWidth: 2.5, pointRadius: 1, pointHoverRadius: 4, tension: 0.3, yAxisID: yid, order: 1 });
    }
    return ds;
  }, [compRows, mode]);

  const showT = mode === 'both' || mode === 'temp';
  const showH = mode === 'both' || mode === 'hum';
  const scales = useMemo(() => {
    const s = {
      x: { type: 'linear', min: 0, max: 24, ticks: { stepSize: 3, callback: v => hourAmPm(v >= 24 ? 0 : v), color: '#7d8590', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(31,38,48,0.5)' }, border: { color: '#1f2630' } },
      y: yScale(showT ? '#fb923c' : '#38bdf8'),
    };
    if (showT && showH) s.y1 = yScaleRight('#38bdf8');
    return s;
  }, [showT, showH]);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title">Today vs Yesterday</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="range-tabs">
            {['both', 'temp', 'hum'].map(m => (
              <button key={m} className={`range-tab${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>
                {m === 'both' ? 'Both' : m === 'temp' ? 'Temp' : 'Humidity'}
              </button>
            ))}
          </div>
          <div className="chart-legend">
            {showT && <><LegendDot color="#fb923c" label="Today Temp" /><div className="legend-item"><div className="legend-line" style={{ borderColor: 'rgba(251,146,60,0.45)' }} />Yesterday</div></>}
            {showH && <><LegendDot color="#38bdf8" label="Today Hum" /><div className="legend-item"><div className="legend-line" style={{ borderColor: 'rgba(56,189,248,0.45)' }} />Yesterday</div></>}
          </div>
        </div>
      </div>
      <div style={{ height: 220 }}>
        {datasets.length > 0 && (
          <Line
            data={{ datasets }}
            options={{ responsive: true, maintainAspectRatio: false, animation: false, interaction: { intersect: false, mode: 'nearest' }, plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP, callbacks: { title: items => { if (!items.length) return ''; return hourAmPm(Math.floor(items[0].parsed.x)); } } } }, scales }}
          />
        )}
      </div>
    </div>
  );
}
