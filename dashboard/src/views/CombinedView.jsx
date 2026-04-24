import { useState, useMemo } from 'react';
import { useCombinedData } from '../hooks/useRoomData';
import { RANGES } from '../config';
import { fmt, calcAirQuality, calcComfort } from '../utils';
import RangeTabs from '../components/RangeTabs';
import { ChartCard, LegendDot, TimeSeriesChart, yScale } from '../components/ChartCard';
import DeviceStatus from '../components/DeviceStatus';
import Overlay from '../components/Overlay';

export default function CombinedView() {
  const [range, setRange] = useState('6h');
  const { room1, room2, r1Range, r2Range, loading } = useCombinedData(range);

  const r1aqi = room1 ? calcAirQuality(room1.gas_level) : null;
  const r2aqi = room2 ? calcAirQuality(room2.air_quality) : null;

  // Deltas
  function delta(v1, v2, unit, inverted = false) {
    if (v1 == null || v2 == null) return null;
    const d = v2 - v1;
    if (Math.abs(d) < (unit === '°C' ? 0.2 : unit === '%' ? 1 : 3)) return <span className="delta-same">≈ same</span>;
    const cls = inverted ? (d > 0 ? 'delta-cooler' : 'delta-warmer') : (d > 0 ? 'delta-warmer' : 'delta-cooler');
    const word = unit === '°C' ? (d > 0 ? 'warmer' : 'cooler') : unit === '%' ? (d > 0 ? 'more' : 'less') + ' humid' : (d > 0 ? 'better' : 'worse');
    return <span className={cls}>R2 is {Math.abs(d).toFixed(unit === '%' ? 0 : 1)}{unit === 'pts' ? '' : unit} {word}</span>;
  }

  // Home summary
  const temps = [room1?.temperature, room2?.temperature].filter(v => v != null);
  const hums = [room1?.humidity, room2?.humidity].filter(v => v != null);
  const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const avgHum = hums.length ? hums.reduce((a, b) => a + b, 0) / hums.length : null;
  const c1 = calcComfort(room1?.temperature, room1?.humidity);
  const c2 = calcComfort(room2?.temperature, room2?.humidity);
  const scores = [c1.score, c2.score].filter(v => v != null);
  const avgComfort = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Chart datasets
  const tempDS = useMemo(() => [
    { label: 'Room 1', data: r1Range.filter(r => r.temperature != null).map(r => ({ x: r.created_at, y: r.temperature })), borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
    { label: 'Room 2', data: r2Range.filter(r => r.temperature != null).map(r => ({ x: r.created_at, y: r.temperature })), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
  ], [r1Range, r2Range]);

  const humDS = useMemo(() => [
    { label: 'Room 1', data: r1Range.filter(r => r.humidity != null).map(r => ({ x: r.created_at, y: r.humidity })), borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
    { label: 'Room 2', data: r2Range.filter(r => r.humidity != null).map(r => ({ x: r.created_at, y: r.humidity })), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
  ], [r1Range, r2Range]);

  const airDS = useMemo(() => [
    { label: 'Room 1', data: r1Range.filter(r => r.gas_level != null).map(r => ({ x: r.created_at, y: calcAirQuality(r.gas_level) })), borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
    { label: 'Room 2', data: r2Range.filter(r => r.air_quality != null).map(r => ({ x: r.created_at, y: calcAirQuality(r.air_quality) })), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
  ], [r1Range, r2Range]);

  if (loading && !room1 && !room2) return <Overlay title="Loading" message="Fetching combined data…" visible />;

  return (
    <div className="view active">
      <div className="section-header">
        <div><div className="section-title">Combined — <span style={{ color: 'var(--r1)' }}>Room 1</span> vs <span style={{ color: 'var(--r2)' }}>Room 2</span></div><div className="section-sub">Side-by-side comparison of both rooms</div></div>
      </div>
      <div className="device-status-row">
        <DeviceStatus room="room1" latest={room1} />
        <DeviceStatus room="room2" latest={room2} />
      </div>

      <div className="home-summary-card">
        <div className="home-summary-item"><div className="home-summary-value" style={{ color: avgComfort != null ? calcComfort(avgTemp, avgHum).color : undefined }}>{avgComfort ?? '—'}</div><div className="home-summary-label">Home Comfort</div></div>
        <div className="home-summary-item"><div className="home-summary-value">{avgTemp != null ? fmt(avgTemp) + ' °C' : '—'}</div><div className="home-summary-label">Avg Temperature</div></div>
        <div className="home-summary-item"><div className="home-summary-value">{avgHum != null ? fmt(avgHum) + ' %' : '—'}</div><div className="home-summary-label">Avg Humidity</div></div>
        <div className="home-summary-item"><div className="home-summary-value" style={{ color: room2?.is_home ? 'var(--ok)' : 'var(--text-faint)' }}>{room2?.is_home ? 'Home' : 'Away'}</div><div className="home-summary-label">Presence</div></div>
      </div>

      <div className="section-title">Live Comparison</div>
      <div className="compare-grid">
        <div className="compare-card r1"><div className="compare-room" style={{ color: 'var(--r1)' }}>Room 1</div><div className="compare-label">Temperature</div><div><span className="compare-value">{room1 ? fmt(room1.temperature) : '—'}</span><span className="compare-unit">°C</span></div><div className="compare-delta">{delta(room1?.temperature, room2?.temperature, '°C')}</div></div>
        <div className="compare-card r2"><div className="compare-room" style={{ color: 'var(--r2)' }}>Room 2</div><div className="compare-label">Temperature</div><div><span className="compare-value">{room2 ? fmt(room2.temperature) : '—'}</span><span className="compare-unit">°C</span></div></div>
        <div className="compare-card r1"><div className="compare-room" style={{ color: 'var(--r1)' }}>Room 1</div><div className="compare-label">Humidity</div><div><span className="compare-value">{room1 ? fmt(room1.humidity) : '—'}</span><span className="compare-unit">%</span></div><div className="compare-delta">{delta(room1?.humidity, room2?.humidity, '%')}</div></div>
        <div className="compare-card r2"><div className="compare-room" style={{ color: 'var(--r2)' }}>Room 2</div><div className="compare-label">Humidity</div><div><span className="compare-value">{room2 ? fmt(room2.humidity) : '—'}</span><span className="compare-unit">%</span></div></div>
        <div className="compare-card r1"><div className="compare-room" style={{ color: 'var(--r1)' }}>Room 1</div><div className="compare-label">Air Quality</div><div><span className="compare-value">{r1aqi ?? '—'}</span><span className="compare-unit">/100</span></div><div className="compare-delta">{delta(r1aqi, r2aqi, 'pts', true)}</div></div>
        <div className="compare-card r2"><div className="compare-room" style={{ color: 'var(--r2)' }}>Room 2</div><div className="compare-label">Air Quality</div><div><span className="compare-value">{r2aqi ?? '—'}</span><span className="compare-unit">/100</span></div></div>
      </div>

      <div className="range-bar">
        <RangeTabs current={range} onChange={setRange} />
        <div className="range-meta">Showing {RANGES[range].label}</div>
      </div>

      <div className="charts">
        <ChartCard title="Temperature Comparison" legend={<><LegendDot color="var(--r1)" label="Room 1" /><LegendDot color="var(--r2)" label="Room 2" /></>}>
          <TimeSeriesChart datasets={tempDS} scales={{ y: yScale('#7d8590') }} />
        </ChartCard>
        <ChartCard title="Humidity Comparison" legend={<><LegendDot color="var(--r1)" label="Room 1" /><LegendDot color="var(--r2)" label="Room 2" /></>}>
          <TimeSeriesChart datasets={humDS} scales={{ y: yScale('#7d8590') }} />
        </ChartCard>
        <ChartCard title="Air Quality Comparison" legend={<><LegendDot color="var(--r1)" label="Room 1 (MQ2)" /><LegendDot color="var(--r2)" label="Room 2 (MQ135)" /></>}>
          <TimeSeriesChart datasets={airDS} scales={{ y: { ...yScale('#7d8590'), min: 0, max: 100 } }} />
        </ChartCard>
      </div>
    </div>
  );
}
