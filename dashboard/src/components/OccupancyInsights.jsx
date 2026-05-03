import { useMemo } from 'react';
import { Home, Clock, CalendarCheck, AlertTriangle, TrendingUp, Monitor, Activity } from 'lucide-react';
import { timeAgo, hourAmPm } from '../utils';

function computeStats(insights7d, presence, latest) {
  const now = Date.now();

  // device staleness
  const deviceAge = latest?.created_at ? now - new Date(latest.created_at).getTime() : null;
  const deviceStale = deviceAge == null || deviceAge > 5 * 60 * 1000;

  // current is_home status
  let presenceStatus = 'unknown';
  let presenceNote = null;
  if (!deviceStale && latest?.is_home != null) {
    presenceStatus = latest.is_home ? 'home' : 'away';
  } else if (deviceStale) {
    presenceNote = 'Device offline';
  }

  // current desk (motion)
  const atDeskNow = !deviceStale && latest?.motion === true;

  // last presence event
  const lastEvent = presence?.length > 0 ? presence[0] : null;
  const lastEventTime = lastEvent ? new Date(lastEvent.created_at) : null;

  // per-day maps
  function dk(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  const todayKey = dk(new Date());
  const homeDayMap   = new Map();
  const motionDayMap = new Map();

  for (const r of insights7d) {
    const d = new Date(r.created_at);
    const k = dk(d);
    const h = d.getHours();
    if (!homeDayMap.has(k))   homeDayMap.set(k, new Set());
    if (!motionDayMap.has(k)) motionDayMap.set(k, new Set());
    if (r.is_home) homeDayMap.get(k).add(h);
    if (r.motion)  motionDayMap.get(k).add(h);
  }

  const totalDays = Math.max(homeDayMap.size, motionDayMap.size, 1);

  // today
  const todayHomeHrs   = Math.min(homeDayMap.get(todayKey)?.size ?? 0, 12);
  const todayMotionHrs = motionDayMap.get(todayKey)?.size ?? 0;

  // 7d home avg
  let sumHomeHrs = 0, homeDaysOcc = 0;
  for (const hrs of homeDayMap.values()) {
    const c = Math.min(hrs.size, 12);
    sumHomeHrs += c;
    if (c > 0) homeDaysOcc++;
  }
  const avgHomePDay = (sumHomeHrs / totalDays).toFixed(1);

  // 7d desk avg
  let sumMotionHrs = 0, motionDaysOcc = 0;
  for (const hrs of motionDayMap.values()) {
    sumMotionHrs += hrs.size;
    if (hrs.size > 0) motionDaysOcc++;
  }
  const avgMotionPDay = (sumMotionHrs / totalDays).toFixed(1);

  // peak desk hour: which hour had motion on the most days
  const hourDaySets = Array.from({ length: 24 }, () => new Set());
  for (const r of insights7d) {
    if (!r.motion) continue;
    const d = new Date(r.created_at);
    hourDaySets[d.getHours()].add(dk(d));
  }
  let peakHour = -1, peakCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hourDaySets[h].size > peakCount) { peakCount = hourDaySets[h].size; peakHour = h; }
  }
  const peakLabel = peakHour >= 0 ? hourAmPm(peakHour) : null;
  const peakPct   = Math.round((peakCount / totalDays) * 100);

  // stuck sensor: every day has ≥20 home-hours
  const stuckSensor = homeDayMap.size >= 3 && [...homeDayMap.values()].every(s => s.size >= 20);

  return {
    presenceStatus, presenceNote, atDeskNow,
    lastEvent, lastEventTime,
    todayHomeHrs, todayMotionHrs,
    avgHomePDay, homeDaysOcc, totalDays,
    avgMotionPDay, motionDaysOcc,
    peakLabel, peakPct,
    stuckSensor,
  };
}

export default function OccupancyInsights({ latest, insights7d, presence }) {
  const s = useMemo(
    () => computeStats(insights7d, presence, latest),
    [insights7d, presence, latest]
  );

  const presenceColor = { home: 'var(--ok)', away: 'var(--text-faint)', unknown: 'oklch(0.70 0.11 55)' }[s.presenceStatus];
  const presenceLabel = { home: 'Home', away: 'Away', unknown: 'Unknown' }[s.presenceStatus];

  return (
    <div className="occupancy-insights">
      <div className="occ-header">
        <span className="section-title" style={{ marginBottom: 0 }}>Occupancy Insights</span>
        {s.stuckSensor && (
          <div className="occ-warn">
            <AlertTriangle size={13} />
            is_home may be stuck — home hours capped at 12h/day
          </div>
        )}
      </div>

      {/* ── Home Presence (is_home / phone WiFi) ── */}
      <div className="occ-section-label">
        <Home size={11} style={{ display: 'inline', marginRight: 4 }} />
        Home Presence · phone WiFi
      </div>
      <div className="occ-grid">
        <div className="occ-card">
          <div className="occ-icon" style={{ background: `${presenceColor}22`, color: presenceColor }}>
            <Home size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">Right Now</div>
            <div className="occ-value" style={{ color: presenceColor }}>{presenceLabel}</div>
            {s.presenceNote
              ? <div className="occ-sub" style={{ color: 'oklch(0.70 0.11 55)' }}>{s.presenceNote}</div>
              : s.lastEventTime
                ? <div className="occ-sub">Since {timeAgo(s.lastEventTime)}</div>
                : null}
          </div>
        </div>

        <div className="occ-card">
          <div className="occ-icon" style={{ background: 'oklch(0.70 0.10 220 / 0.12)', color: 'oklch(0.70 0.10 220)' }}>
            <Clock size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">Last Event</div>
            <div className="occ-value">
              {s.lastEvent ? (s.lastEvent.event_type === 'arrived' ? 'Arrived' : 'Left') : '—'}
            </div>
            <div className="occ-sub">
              {s.lastEventTime ? timeAgo(s.lastEventTime) : 'No data'}
              {s.lastEvent?.person ? ` · ${s.lastEvent.person}` : ''}
            </div>
          </div>
        </div>

        <div className="occ-card">
          <div className="occ-icon" style={{ background: 'oklch(0.68 0.10 155 / 0.12)', color: 'oklch(0.68 0.10 155)' }}>
            <CalendarCheck size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">Today Home</div>
            <div className="occ-value">
              {s.todayHomeHrs}<span style={{ fontSize: 12, opacity: 0.6, marginLeft: 3 }}>hrs</span>
            </div>
            <div className="occ-sub">{s.todayHomeHrs >= 12 ? 'Capped at 12h' : 'Unique hours home'}</div>
          </div>
        </div>

        <div className="occ-card">
          <div className="occ-icon" style={{ background: 'oklch(0.75 0.14 55 / 0.12)', color: 'oklch(0.75 0.14 55)' }}>
            <TrendingUp size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">7-Day Avg</div>
            <div className="occ-value">{s.avgHomePDay} <span style={{ fontSize: 12, opacity: 0.6 }}>hrs/day</span></div>
            <div className="occ-sub">{s.homeDaysOcc} of {s.totalDays} days home</div>
          </div>
        </div>
      </div>

      {/* ── Desk Occupancy (PIR motion) ── */}
      <div className="occ-section-label" style={{ marginTop: 14 }}>
        <Monitor size={11} style={{ display: 'inline', marginRight: 4 }} />
        Desk Occupancy · PIR motion sensor
      </div>
      <div className="occ-grid">
        <div className="occ-card">
          <div className="occ-icon" style={{
            background: s.atDeskNow ? 'oklch(0.68 0.10 155 / 0.15)' : 'oklch(0.22 0.012 55)',
            color: s.atDeskNow ? 'var(--ok)' : 'var(--text-faint)',
          }}>
            <Monitor size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">Right Now</div>
            <div className="occ-value" style={{ color: s.atDeskNow ? 'var(--ok)' : 'var(--text-faint)' }}>
              {s.atDeskNow ? 'At Desk' : 'Away'}
            </div>
            <div className="occ-sub">PIR motion sensor</div>
          </div>
        </div>

        <div className="occ-card">
          <div className="occ-icon" style={{ background: 'oklch(0.68 0.10 155 / 0.12)', color: 'oklch(0.68 0.10 155)' }}>
            <CalendarCheck size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">Today at Desk</div>
            <div className="occ-value">
              {s.todayMotionHrs}<span style={{ fontSize: 12, opacity: 0.6, marginLeft: 3 }}>hrs</span>
            </div>
            <div className="occ-sub">Unique hours with motion</div>
          </div>
        </div>

        <div className="occ-card">
          <div className="occ-icon" style={{ background: 'oklch(0.75 0.14 55 / 0.12)', color: 'oklch(0.75 0.14 55)' }}>
            <TrendingUp size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">7-Day Avg</div>
            <div className="occ-value">{s.avgMotionPDay} <span style={{ fontSize: 12, opacity: 0.6 }}>hrs/day</span></div>
            <div className="occ-sub">{s.motionDaysOcc} of {s.totalDays} days at desk</div>
          </div>
        </div>

        <div className="occ-card">
          <div className="occ-icon" style={{ background: 'oklch(0.68 0.12 310 / 0.12)', color: 'oklch(0.68 0.12 310)' }}>
            <Activity size={18} />
          </div>
          <div className="occ-body">
            <div className="occ-label">Peak Desk Hour</div>
            <div className="occ-value">{s.peakLabel ?? '—'}</div>
            <div className="occ-sub">
              {s.peakLabel ? `Active ${s.peakPct}% of days` : 'No data'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
