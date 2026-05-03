import { useMemo } from 'react';
import { Thermometer, Droplets, Wind, Activity, Home } from 'lucide-react';
import { fmt, calcAirQuality } from '../utils';

function StatItem({ label, value, unit, sub, color, icon: Icon }) {
  return (
    <div className="cs-item">
      <div className="cs-icon" style={{ color: color || 'var(--text-dim)' }}>
        <Icon size={16} />
      </div>
      <div className="cs-body">
        <div className="cs-label">{label}</div>
        <div className="cs-value" style={{ color }}>
          {value != null ? value : '—'}
          {unit && value != null && <span className="cs-unit"> {unit}</span>}
        </div>
        {sub && <div className="cs-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function CombinedStats({ room1, room2, r1Range, r2Range, r1Insights7d, r2Insights7d }) {
  const stats = useMemo(() => {
    const avg = (arr, key) => {
      const vals = arr.map(r => r[key]).filter(v => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const r1Temp = avg(r1Range, 'temperature');
    const r2Temp = avg(r2Range, 'temperature');
    const r1Hum = avg(r1Range, 'humidity');
    const r2Hum = avg(r2Range, 'humidity');
    const r1Aqi = (() => { const v = avg(r1Range.map(r => ({ v: calcAirQuality(r.gas_level) })), 'v'); return v; })();
    const r2Aqi = (() => { const v = avg(r2Range.map(r => ({ v: calcAirQuality(r.air_quality) })), 'v'); return v; })();

    const hotterRoom = r1Temp != null && r2Temp != null
      ? r1Temp > r2Temp ? `Room 1 (+${(r1Temp - r2Temp).toFixed(1)}°C)` : `Room 2 (+${(r2Temp - r1Temp).toFixed(1)}°C)`
      : null;

    const moreHumidRoom = r1Hum != null && r2Hum != null
      ? r1Hum > r2Hum ? `Room 1 (+${(r1Hum - r2Hum).toFixed(0)}%)` : `Room 2 (+${(r2Hum - r1Hum).toFixed(0)}%)`
      : null;

    const betterAirRoom = r1Aqi != null && r2Aqi != null
      ? r1Aqi > r2Aqi ? `Room 1 (${Math.round(r1Aqi)}/100)` : `Room 2 (${Math.round(r2Aqi)}/100)`
      : null;

    const tempDelta = r1Temp != null && r2Temp != null ? Math.abs(r1Temp - r2Temp) : null;

    // Combined occupancy from insights (is_home for room2, motion for room1)
    const r1OccHours = new Set();
    const r2OccHours = new Set();
    for (const r of r1Insights7d) { if (r.motion) { const h = new Date(r.created_at).getHours(); r1OccHours.add(`${new Date(r.created_at).toDateString()}-${h}`); } }
    for (const r of r2Insights7d) { if (r.is_home) { const h = new Date(r.created_at).getHours(); r2OccHours.add(`${new Date(r.created_at).toDateString()}-${h}`); } }

    // Current occupancy status
    const r1Occ = room1?.motion ?? false;
    const r2Occ = room2?.is_home ?? false;
    let occStatus;
    if (r1Occ && r2Occ) occStatus = 'Both rooms occupied';
    else if (r1Occ) occStatus = 'Room 1 active';
    else if (r2Occ) occStatus = 'Someone home (Room 2)';
    else occStatus = 'All clear';

    // Peak hours this week (combined motion/is_home)
    const hourBuckets = Array(24).fill(0);
    for (const r of r1Insights7d) { if (r.motion) hourBuckets[new Date(r.created_at).getHours()]++; }
    for (const r of r2Insights7d) { if (r.is_home) hourBuckets[new Date(r.created_at).getHours()]++; }
    const peakHour = hourBuckets.reduce((best, v, i) => v > hourBuckets[best] ? i : best, 0);
    const peakHourLabel = `${peakHour}:00 – ${peakHour + 1}:00`;

    return {
      hotterRoom, moreHumidRoom, betterAirRoom, tempDelta,
      occStatus, peakHourLabel,
      r1LiveTemp: room1?.temperature, r2LiveTemp: room2?.temperature,
    };
  }, [room1, room2, r1Range, r2Range, r1Insights7d, r2Insights7d]);

  return (
    <div className="combined-stats">
      <div className="section-title">Home Statistics</div>
      <div className="cs-grid">
        <StatItem
          label="Warmer Room"
          value={stats.hotterRoom}
          icon={Thermometer}
          color="oklch(0.75 0.14 40)"
          sub={stats.tempDelta != null ? `${fmt(stats.tempDelta, 1)}°C difference` : undefined}
        />
        <StatItem
          label="More Humid Room"
          value={stats.moreHumidRoom}
          icon={Droplets}
          color="oklch(0.70 0.10 220)"
        />
        <StatItem
          label="Better Air Quality"
          value={stats.betterAirRoom}
          icon={Wind}
          color="oklch(0.68 0.10 155)"
        />
        <StatItem
          label="Current Occupancy"
          value={stats.occStatus}
          icon={Activity}
          color={stats.occStatus === 'All clear' ? 'var(--text-faint)' : 'var(--ok)'}
        />
        <StatItem
          label="Peak Activity Hour (7d)"
          value={stats.peakHourLabel}
          icon={Home}
          color="oklch(0.72 0.12 70)"
          sub="Combined both rooms"
        />
      </div>
    </div>
  );
}
