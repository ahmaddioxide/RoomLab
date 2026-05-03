import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Thermometer, Droplets, Wind } from 'lucide-react';
import { computeTrends, fmt, calcComfort } from '../utils';

function TrendCard({ label, slope, unit, currentVal, icon: Icon, accentColor }) {
  const isNeutral = slope == null || Math.abs(slope) < 0.05;
  const isRising = slope != null && slope > 0.05;
  const isFalling = slope != null && slope < -0.05;

  const TrendIcon = isNeutral ? Minus : isRising ? TrendingUp : TrendingDown;
  const trendColor = isNeutral
    ? 'oklch(0.62 0.02 65)'
    : isRising ? 'oklch(0.70 0.14 40)' : 'oklch(0.62 0.12 225)';

  const trendLabel = isNeutral
    ? 'Stable'
    : isRising ? `Rising ${fmt(Math.abs(slope), 1)}${unit}/hr`
    : `Falling ${fmt(Math.abs(slope), 1)}${unit}/hr`;

  // 6-hour projection
  const projection = currentVal != null && slope != null
    ? currentVal + slope * 6
    : null;

  return (
    <div className="wp-trend-card">
      <div className="wp-trend-icon" style={{ background: `${accentColor}18`, color: accentColor }}>
        <Icon size={16} />
      </div>
      <div className="wp-trend-body">
        <div className="wp-trend-label">{label}</div>
        <div className="wp-trend-status" style={{ color: trendColor }}>
          <TrendIcon size={13} style={{ display: 'inline', marginRight: 4 }} />
          {trendLabel}
        </div>
        {projection != null && (
          <div className="wp-trend-projection">
            In 6h: ~{fmt(projection)}{unit}
          </div>
        )}
      </div>
    </div>
  );
}

function RoomPrediction({ label, rows, gasField, accentColor, latestTemp, latestHum }) {
  const trends = useMemo(() => computeTrends(rows, gasField), [rows, gasField]);
  const comfort = calcComfort(latestTemp, latestHum);

  // Comfort trajectory
  const projTemp = latestTemp != null && trends.temp != null ? latestTemp + trends.temp * 6 : null;
  const projHum = latestHum != null && trends.hum != null ? latestHum + trends.hum * 6 : null;
  const projComfort = projTemp != null && projHum != null ? calcComfort(projTemp, projHum) : null;

  const comfortChanging = projComfort && comfort.score != null
    && Math.abs(projComfort.score - comfort.score) >= 5;

  return (
    <div className="wp-room-block">
      <div className="wp-room-label" style={{ color: accentColor }}>{label}</div>
      <div className="wp-trends-row">
        <TrendCard
          label="Temperature"
          slope={trends.temp}
          unit="°C"
          currentVal={latestTemp}
          icon={Thermometer}
          accentColor="oklch(0.75 0.14 55)"
        />
        <TrendCard
          label="Humidity"
          slope={trends.hum}
          unit="%"
          currentVal={latestHum}
          icon={Droplets}
          accentColor="oklch(0.70 0.10 220)"
        />
        <TrendCard
          label="Air Quality"
          slope={trends.gas}
          unit=""
          currentVal={null}
          icon={Wind}
          accentColor="oklch(0.68 0.12 310)"
        />
      </div>
      {comfortChanging && (
        <div className="wp-comfort-forecast">
          Comfort may shift from <strong style={{ color: comfort.color }}>{comfort.label}</strong>
          {' '}→ <strong style={{ color: projComfort.color }}>{projComfort.label}</strong> in 6 hours
        </div>
      )}
    </div>
  );
}

export default function WeatherPrediction({ r1Range, r2Range, room1, room2 }) {
  if (!r1Range.length && !r2Range.length) return null;

  return (
    <div className="weather-prediction">
      <div className="section-title">Short-Term Forecast</div>
      <div className="wp-note">Based on linear regression of {r1Range.length || r2Range.length} recent readings</div>
      <div className="wp-rooms">
        {r1Range.length > 0 && (
          <RoomPrediction
            label="Room 1"
            rows={r1Range}
            gasField="gas_level"
            accentColor="oklch(0.72 0.12 70)"
            latestTemp={room1?.temperature}
            latestHum={room1?.humidity}
          />
        )}
        {r2Range.length > 0 && (
          <RoomPrediction
            label="Room 2"
            rows={r2Range}
            gasField="air_quality"
            accentColor="oklch(0.68 0.10 155)"
            latestTemp={room2?.temperature}
            latestHum={room2?.humidity}
          />
        )}
      </div>
    </div>
  );
}
