import { useState, useMemo } from 'react';
import { useRoomData } from '../hooks/useRoomData';
import { RANGES, ROOM_CONFIG, MOTION_OCCUPIED_MS } from '../config';
import { fmt, calcAirQuality, getAQIInfo, computeTrends, hourAmPm, durationStr } from '../utils';
import { useInterval } from '../hooks/useInterval';
import LiveCard, { TrendBadge, AqiDisplay } from '../components/LiveCard';
import ComfortSection from '../components/ComfortSection';
import RangeTabs from '../components/RangeTabs';
import { ChartCard, BarChartCard } from '../components/ChartCard';
import SensorAreaChart from '../components/SensorAreaChart';
import DayComparisonChart from '../components/DayComparisonChart';
import Heatmap from '../components/Heatmap';
import StatsGrid, { calcStats } from '../components/StatsGrid';
import SummaryGrid from '../components/SummaryGrid';
import PresenceLog from '../components/PresenceLog';
import OccupancyInsights from '../components/OccupancyInsights';
import DailyStatsTable from '../components/DailyStatsTable';
import DeviceStatus from '../components/DeviceStatus';
import Overlay from '../components/Overlay';

export default function Room2View() {
  const [range, setRange] = useState('6h');
  const { bucketed, rangeData, latest, insights7d, insights30d, presence, dailyStats, loading } = useRoomData('room2', range);
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

  const tempData = useMemo(() =>
    bucketed.filter(r => r.temperature != null).map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      temperature: r.temperature,
    })),
  [bucketed]);

  const humData = useMemo(() =>
    bucketed.filter(r => r.humidity != null).map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      humidity: r.humidity,
    })),
  [bucketed]);

  const pressureData = useMemo(() =>
    bucketed.filter(r => r.pressure != null && r.pressure > 0).map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      pressure: r.pressure,
    })),
  [bucketed]);

  const airData = useMemo(() =>
    bucketed.filter(r => r[cfg.gasField] != null).map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      airQuality: r[cfg.gasField],
    })),
  [bucketed, cfg.gasField]);

  const lightData = useMemo(() =>
    bucketed.filter(r => r.light_value != null).map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      light: r.light_value,
    })),
  [bucketed]);

  const motionData = useMemo(() =>
    bucketed.map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      motion: r.motion ? 1 : 0,
    })),
  [bucketed]);

  const peakData = useMemo(() => {
    const hourDays = Array.from({ length: 24 }, () => new Set());
    const allDays = new Set();
    for (const r of insights7d) {
      const d = new Date(r.created_at);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      allDays.add(dayKey);
      if (r.motion) hourDays[d.getHours()].add(dayKey);
    }
    const totalDays = Math.max(allDays.size, 1);
    return hourDays.map(days => Math.round((days.size / totalDays) * 100));
  }, [insights7d]);

  const statsFields = useMemo(() => [
    { title: 'Temperature', ...calcStats(rangeData, 'temperature'), unit: '°C', dec: 1 },
    { title: 'Humidity', ...calcStats(rangeData, 'humidity'), unit: '%', dec: 1 },
    { title: 'Air Quality', ...calcStats(rangeData, cfg.gasField), unit: '', dec: 0 },
  ], [rangeData, cfg.gasField]);

  if (loading && !latest) return <Overlay title="Loading" message="Fetching Room 2 data…" visible />;

  return (
    <div className="view active">
      <div className="section-header">
        <div>
          <div className="section-title">Room 2</div>
          <div className="section-sub">Climate · Pressure · Air Quality · Light · Motion</div>
        </div>
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
          <div className="card-meta">{latest?.light_value != null ? `Level: ${latest.light_value}` : '—'}</div>
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
        <SensorAreaChart
          title="Temperature"
          description={`Showing ${RANGES[range].label}`}
          data={tempData}
          series={[{ key: 'temperature', label: 'Temperature °C', color: 'oklch(0.75 0.14 55)' }]}
        />
        <SensorAreaChart
          title="Humidity"
          description={`Showing ${RANGES[range].label}`}
          data={humData}
          series={[{ key: 'humidity', label: 'Humidity %', color: 'oklch(0.70 0.10 220)' }]}
        />
        <DayComparisonChart rows={insights30d} room="room2" table="esp32_monitor" />
        <SensorAreaChart
          title="Pressure"
          description="Barometric pressure"
          data={pressureData}
          series={[{ key: 'pressure', label: 'Pressure hPa', color: 'oklch(0.70 0.11 155)' }]}
        />
        <SensorAreaChart
          title="Air Quality"
          description="Air quality sensor"
          data={airData}
          series={[{ key: 'airQuality', label: 'Air Quality', color: 'oklch(0.68 0.12 310)' }]}
        />
        <SensorAreaChart
          title="Light Level"
          description="Ambient light sensor"
          data={lightData}
          series={[{ key: 'light', label: 'Light Level', color: 'oklch(0.78 0.13 85)' }]}
        />
        <SensorAreaChart
          title="Motion Activity"
          description="Movement detection"
          data={motionData}
          series={[{ key: 'motion', label: 'Motion', color: 'oklch(0.78 0.13 85)' }]}
          yFormatter={(v) => v ? 'On' : 'Off'}
        />
      </div>

      <OccupancyInsights
        latest={latest}
        insights7d={insights7d}
        insights30d={insights30d}
        presence={presence}
      />

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
      <SummaryGrid weekData={insights7d} monthData={insights30d} showOccupancy />

      <DailyStatsTable table="esp32_monitor" showOccupancy />

      <StatsGrid fields={statsFields} />
    </div>
  );
}
