export default function TopBar({ activeView, onSwitch, lastTs }) {
  const views = [
    { key: 'room1', label: 'Room 1', color: 'var(--r1)' },
    { key: 'room2', label: 'Room 2', color: 'var(--r2)' },
    { key: 'combined', label: 'Combined', color: 'var(--text-dim)' },
  ];
  const ts = lastTs ? new Date(lastTs) : null;
  const tsStr = ts
    ? `${ts.toLocaleDateString('en', { month: 'short', day: 'numeric' })} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}:${String(ts.getSeconds()).padStart(2, '0')}`
    : '—';

  return (
    <div className="top-bar">
      <div className="top-bar-inner">
        <div className="top-brand">AirPulse</div>
        <div className="nav-tabs">
          {views.map(v => (
            <button
              key={v.key}
              className={`nav-tab${activeView === v.key ? ' active' : ''}`}
              onClick={() => onSwitch(v.key)}
            >
              <span className="tab-dot" style={{ background: v.color }} />
              <span className="nav-tab-label">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="top-status">
          <span className="top-status-ts">{tsStr}</span>
          <div className="conn live"><div className="conn-dot" /><span>Live</span></div>
        </div>
      </div>
    </div>
  );
}
