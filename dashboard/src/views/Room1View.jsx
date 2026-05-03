import { useState, useMemo } from 'react';
import { useRoomData } from '../hooks/useRoomData';
import { RANGES, ROOM_CONFIG } from '../config';
import { fmt, calcAirQuality, getAQIInfo, computeTrends } from '../utils';
import LiveCard, { TrendBadge, AqiDisplay } from '../components/LiveCard';
import ComfortSection from '../components/ComfortSection';
import RangeTabs from '../components/RangeTabs';
import SensorAreaChart from '../components/SensorAreaChart';
import DayComparisonChart from '../components/DayComparisonChart';
import StatsGrid, { calcStats } from '../components/StatsGrid';
import SummaryGrid from '../components/SummaryGrid';
import DailyStatsTable from '../components/DailyStatsTable';
import DeviceStatus from '../components/DeviceStatus';
import Overlay from '../components/Overlay';

export default function Room1View() {
  const [range, setRange] = useState('6h');
  const { bucketed, rangeData, latest, insights7d, insights30d, loading } = useRoomData('room1', range);
  const cfg = ROOM_CONFIG.room1;

  const gasVal = latest?.[cfg.gasField];
  const aqiScore = calcAirQuality(gasVal);
  const aqiInfo = getAQIInfo(aqiScore);
  const recentRows = useMemo(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    return rangeData.filter(r => new Date(r.created_at).getTime() > cutoff);
  }, [rangeData]);
  const trends = useMemo(() => computeTrends(recentRows, cfg.gasField), [recentRows, cfg.gasField]);

  // Separate chart data for temperature and humidity
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

  const gasData = useMemo(() =>
    bucketed.filter(r => r[cfg.gasField] != null).map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      gas: r[cfg.gasField],
    })),
  [bucketed, cfg.gasField]);

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
        <div><div className="section-title">Room 1</div><div className="section-sub">Temperature · Humidity · Air Quality</div></div>
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
        <SensorAreaChart
          title="Temperature"
          description={`Showing ${RANGES[range].label}`}
          data={tempData}
          series={[
            { key: 'temperature', label: 'Temperature °C', color: 'oklch(0.75 0.14 55)' },
          ]}
        />
        <SensorAreaChart
          title="Humidity"
          description={`Showing ${RANGES[range].label}`}
          data={humData}
          series={[
            { key: 'humidity', label: 'Humidity %', color: 'oklch(0.70 0.10 220)' },
          ]}
        />
        <DayComparisonChart rows={insights30d} room="room1" table="room_monitor" />
        <SensorAreaChart
          title="Gas Level"
          description="MQ2 gas sensor"
          data={gasData}
          series={[
            { key: 'gas', label: 'Gas Level', color: 'oklch(0.68 0.12 310)' },
          ]}
        />
      </div>

      <div className="section-title">Summary</div>
      <SummaryGrid weekData={insights7d} monthData={insights30d} showOccupancy={false} />

      <StatsGrid fields={statsFields} />

      <DailyStatsTable table="room_monitor" showOccupancy={false} />
    </div>
  );
}
