import { Home, HandMetal } from 'lucide-react';

export default function PresenceLog({ events }) {
  if (!events || !events.length) return <div style={{ color: 'var(--text-faint)' }}>No presence events</div>;
  return (
    <div className="presence-log">
      {events.slice(0, 50).map((e, i) => {
        const ts = new Date(e.created_at);
        const hh = String(ts.getHours()).padStart(2, '0');
        const mm = String(ts.getMinutes()).padStart(2, '0');
        const day = ts.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        const isArr = e.event_type === 'arrived';
        return (
          <div key={i} className="presence-event">
            <div className={`presence-icon ${isArr ? 'presence-arrived' : 'presence-left'}`}>{isArr ? <Home size={16} /> : <HandMetal size={16} />}</div>
            <div className="presence-text">
              <div className="presence-name">{e.person} {isArr ? 'arrived' : 'left'}</div>
              <div className="presence-time">{day} {hh}:{mm}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
