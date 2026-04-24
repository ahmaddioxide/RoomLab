import { useState, useMemo } from 'react';
import { useRoomData } from '../hooks/useRoomData';
import { RANGES, ROOM_CONFIG, MOTION_OCCUPIED_MS } from '../config';
import { fmt, calcAirQuality, getAQIInfo, computeTrends, hourAmPm, durationStr } from '../utils';
import { useInterval } from '../hooks/useInterval';
import LiveCard, { TrendBadge, AqiDisplay } from '../components/LiveCard';
import ComfortSection from '../components/ComfortSection';
import RangeTabs from '../components/RangeTabs';
import { ChartCard, LegendDot, TimeSeriesChart, BarChartCard, yScale, yScaleRight } from '../components/ChartCard';
import Heatmap from '../components/Heatmap';
import StatsGrid, { calcStats } from '../components/StatsGrid';
import SummaryGrid from '../components/SummaryGrid';
import PresenceLog from '../components/PresenceLog';
import DeviceStatus from '../components/DeviceStatus';
import Overlay from '../components/Overlay';

export default function Room2View() {
  const [range, setRange] = useState('6h');
  const { bucketed, rangeData, latest, insights7d, insights30d, compRows, presence, loading } = useRoomData('room2', range);
  const cfg = ROOM_CONFIG.room2;
  const [motionAge, setMotionAge] = useState('');

  const gasVal = latest?.[cfg.gasField];
  const aqiScore = calcAirQuality(gasVal);
  const aqiInfo = getAQIInfo(aqiScore);

  const recentRows = useMemo(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    return rangeData.filter(r => new Date(r.created_at).getTime() > cutoff);
  }, [rangeData]);
  const trends = useMemo(() => computeTrends(recentRows, cfg.gasField), [recentRows, cfg.gasField]);

  // Find last motion time
  const lastMotionTime = useMemo(() => {
    for (let i = rangeData.length - 1; i >= 0; i--) {
      if (rangeData[i].motion) return new Date(rangeData[i].created_at);
    }
    return null;
  }, [rangeData]);

  useInterval(() => {
    if (!lastMotionTime) { setMotionAge('No motion data'); return; }
    const d = Date.now() - lastMotionTime.getTime();
    setMotionAge(d < MOTION_OCCUPIED_MS ? 'Currently occupied' : 'Empty for ' + durationStr(d));
  }, 1000);

  // Chart datasets
  const climateDS = useMemo(() => [
    { label: 'Temp', data: bucketed.filter(r => r.temperature != null).map(r => ({ x: r.created_at, y: r.temperature })), borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, yAxisID: 'y' },
    { label: 'Hum', data: bucketed.filter(r => r.humidity != null).map(r => ({ x: r.created_at, y: r.humidity })), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, yAxisID: 'y1' },
  ], [bucketed]);

  const pressureDS = useMemo(() => [
    { label: 'Pressure', data: bucketed.filter(r => r.pressure != null && r.pressure > 0).map(r => ({ x: r.created_at, y: r.pressure })), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 2, fill: true, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
  ], [bucketed]);

  const airDS = useMemo(() => [
    { label: 'Air Quality', data: bucketed.filter(r => r[cfg.gasField] != null).map(r => ({ x: r.created_at, y: r[cfg.gasField] })), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 2, fill: true, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
  ], [bucketed, cfg.gasField]);

  const lightDS = useMemo(() => [
    { label: 'Light', data: bucketed.filter(r => r.light_value != null).map(r => ({ x: r.created_at, y: r.light_value })), borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 2, fill: true, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
  ], [bucketed]);

  const motionDS = useMemo(() => [
    { label: 'Motion', data: bucketed.map(r => ({ x: r.created_at, y: r.motion ? 1 : 0 })), borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.2)', borderWidth: 2, fill: true, pointRadius: 0, stepped: true },
  ], [bucketed]);

  const peakData = useMemo(() => {
    const hours = Array.from({ length: 24 }, () => ({ motion: 0, total: 0 }));
    for (const r of insights7d) { const h = new Date(r.created_at).getHours(); hours[h].total++; if (r.motion) hours[h].motion++; }
    return hours.map(h => h.total > 0 ? Math.round((h.motion / h.total) * 100) : 0);
  }, [insights7d]);

  const statsFields = useMemo(() => [
    { title: 'Temperature', ...calcStats(rangeData, 'temperature'), unit: '°C', dec: 1 },
    { title: 'Humidity', ...calcStats(rangeData, 'humidity'), unit: '%', dec: 1 },
    { title: 'Air Quality', ...calcStats(rangeData, cfg.gasField), unit: '', dec: 0 },
  ], [rangeData, cfg.gasField]);

  const motionScales = useMemo(() => ({
    y: { min: 0, max: 1, grid: { color: 'rgba(31,38,48,0.5)' }, ticks: { color: '#7d8590', stepSize: 1, callback: v => v ? 'on' : 'off', font: { family: 'JetBrains Mono', size: 11 } }, border: { color: '#1f2630' } },
  }), []);

  if (loading && !latest) return <Overlay title="Loading" message="Fetching Room 2 data…" visible />;

  return (
    <div className="view active">
      <div className="section-header">
        <div><div className="section-title">Room 2 — <span style={{ color: 'var(--r2)' }}>ESP32</span></div><div className="section-sub">DHT22 · BMP280 · MQ135 · LDR · PIR · LCD</div></div>
      </div>
      <DeviceStatus room="room2" latest={latest} />

      <div className="live-grid live-grid-7">
        <LiveCard label="Temperature" value={fmt(latest?.temperature)} unit="°C">
          <TrendBadge value={trends.temp} unit="°C/hr" threshold={0.1} />
        </LiveCard>
        <LiveCard label="Humidity" value={fmt(latest?.humidity)} unit="%">
          <TrendBadge value={trends.hum} unit="%/hr" threshold={0.5} />
        </LiveCard>
        <LiveCard label="Pressure" value={latest?.pressure != null && latest.pressure > 0 ? fmt(latest.pressure, 0) : '—'} unit="hPa" meta={latest?.pressure === 0 ? 'Sensor disconnected' : undefined} style={{ fontSize: 28 }} />
        <LiveCard label="Air Quality" value={aqiScore ?? '—'} unit="/100">
          <AqiDisplay score={aqiScore} info={aqiInfo} rawValue={gasVal} />
        </LiveCard>
        <LiveCard label="Light" value={latest?.light_label || '—'} style={{ fontSize: 24 }}>
          <div className="card-meta">{latest?.light_value != null ? `Raw: ${latest.light_value}` : '—'}</div>
        </LiveCard>
        <LiveCard label="Motion" value={latest?.motion ? 'Detected' : 'Clear'} style={{ fontSize: 24 }}>
          <div className="card-meta">
            {latest?.motion
              ? <span className="badge badge-warn">Active</span>
              : <span className="badge badge-ok">No movement</span>}
          </div>
          <div className="time-since" style={motionAge === 'Currently occupied' ? { color: 'var(--teal)' } : undefined}>{motionAge}</div>
        </LiveCard>
        <LiveCard label="Presence" value={latest?.is_home ? 'Home' : 'Away'} style={{ fontSize: 22, color: latest?.is_home ? 'var(--ok)' : 'var(--text-faint)' }}>
          <div className="card-meta">
            {latest?.is_home
              ? <span className="badge badge-ok">Home</span>
              : <span className="badge" style={{ background: 'rgba(74,82,96,0.2)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>Away</span>}
          </div>
        </LiveCard>
      </div>

      <ComfortSection temperature={latest?.temperature} humidity={latest?.humidity} />

      <div className="range-bar">
        <RangeTabs current={range} onChange={setRange} />
        <div className="range-meta">Showing {RANGES[range].label}</div>
      </div>

      <div className="charts">
        <ChartCard title="Temperature & Humidity" legend={<><LegendDot color="var(--temp)" label="Temp" /><LegendDot color="var(--humidity)" label="Humidity" /></>}>
          <TimeSeriesChart datasets={climateDS} scales={{ y: yScale('#fb923c'), y1: yScaleRight('#38bdf8') }} />
        </ChartCard>
        <ChartCard title="Pressure" legend={<LegendDot color="var(--pressure)" label="hPa" />}>
          <TimeSeriesChart datasets={pressureDS} scales={{ y: yScale('#34d399') }} />
        </ChartCard>
        <ChartCard title="Air Quality" legend={<LegendDot color="var(--gas)" label="raw" />}>
          <TimeSeriesChart datasets={airDS} scales={{ y: yScale('#7d8590') }} />
        </ChartCard>
        <ChartCard title="Light Level" legend={<LegendDot color="var(--light)" label="raw" />}>
          <TimeSeriesChart datasets={lightDS} scales={{ y: yScale('#fbbf24') }} />
        </ChartCard>
        <ChartCard title="Motion Activity" legend={<LegendDot color="var(--motion)" label="detected" />}>
          <TimeSeriesChart datasets={motionDS} scales={motionScales} />
        </ChartCard>
      </div>

      <div className="section-title">Presence Events</div>
      <div className="chart-card" style={{ marginBottom: 28 }}>
        <PresenceLog events={presence} />
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
