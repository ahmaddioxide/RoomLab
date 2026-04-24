import { timeAgo } from '../utils';

const THRESHOLDS = { room1: 5 * 60_000, room2: 2 * 60_000 };

export default function DeviceStatus({ room, latest }) {
  const ts = latest?.created_at ? new Date(latest.created_at) : null;
  const age = ts ? Date.now() - ts.getTime() : Infinity;
  const threshold = THRESHOLDS[room] || 5 * 60_000;

  let status, statusClass;
  if (!ts) {
    status = 'No data';
    statusClass = 'device-offline';
  } else if (age < threshold) {
    status = 'Online';
    statusClass = 'device-online';
  } else if (age < threshold * 3) {
    status = 'Stale';
    statusClass = 'device-stale';
  } else {
    status = 'Offline';
    statusClass = 'device-offline';
  }

  const deviceName = room === 'room1' ? 'ESP8266' : room === 'room2' ? 'ESP32' : '';
  const tsStr = ts
    ? ts.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—';

  return (
    <div className={`device-status ${statusClass}`}>
      <div className="device-status-dot" />
      <span className="device-status-name">{deviceName}</span>
      <span className="device-status-label">{status}</span>
      <span className="device-status-sep hide-mobile">·</span>
      <span className="device-status-ts hide-mobile">Last update: {tsStr}</span>
      {ts && <span className="device-status-ago hide-mobile">({timeAgo(ts)})</span>}
    </div>
  );
}
