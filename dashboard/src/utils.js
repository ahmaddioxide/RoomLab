import { GAS_BREAKPOINTS } from './config';

export function fmt(n, d = 1) {
  return n == null ? '—' : Number(n).toFixed(d);
}

export function hourAmPm(h) {
  const p = h < 12 ? 'AM' : 'PM';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h} ${p}`;
}

export function timeAgo(d) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

export function durationStr(ms) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

export function calcAirQuality(gasLevel) {
  if (gasLevel == null) return null;
  for (let i = 0; i < GAS_BREAKPOINTS.length - 1; i++) {
    const a = GAS_BREAKPOINTS[i], b = GAS_BREAKPOINTS[i + 1];
    if (gasLevel >= a.gas && gasLevel <= b.gas) {
      const t = (gasLevel - a.gas) / (b.gas - a.gas);
      return Math.round(a.score + t * (b.score - a.score));
    }
  }
  return gasLevel <= 0 ? 100 : 0;
}

export function getAQIInfo(s) {
  if (s == null) return { label: '—', color: '#7d8590', badgeCls: '' };
  if (s >= 80) return { label: 'Excellent', color: '#22c55e', badgeCls: 'badge-ok' };
  if (s >= 60) return { label: 'Good', color: '#4ade80', badgeCls: 'badge-ok' };
  if (s >= 40) return { label: 'Moderate', color: '#fbbf24', badgeCls: 'badge-warn' };
  if (s >= 20) return { label: 'Poor', color: '#fb923c', badgeCls: 'badge-warn' };
  return { label: 'Hazardous', color: '#ef4444', badgeCls: 'badge-alert' };
}

export function calcHeatIndex(t, rh) {
  if (t == null || rh == null) return null;
  if (t < 20) return t;
  const T = t * 9 / 5 + 32;
  let HI = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
  if (HI >= 80) {
    HI = -42.379 + 2.04901523 * T + 10.14333127 * rh
      - 0.22475541 * T * rh - 0.00683783 * T * T
      - 0.05481717 * rh * rh + 0.00122874 * T * T * rh
      + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
  }
  return (HI - 32) * 5 / 9;
}

export function calcDewPoint(t, rh) {
  if (t == null || rh == null) return null;
  const a = 17.27, b = 237.7;
  const al = (a * t) / (b + t) + Math.log(rh / 100);
  return (b * al) / (a - al);
}

export function calcComfort(t, h) {
  if (t == null || h == null) return { score: null, label: '—', color: '#7d8590' };
  let ts;
  if (t >= 20 && t <= 26) ts = 100 - Math.abs(t - 23) * 5;
  else if (t < 20) ts = Math.max(0, 70 - (20 - t) * 7);
  else ts = Math.max(0, 70 - (t - 26) * 7);
  let hs;
  if (h >= 30 && h <= 60) hs = 100 - Math.abs(h - 45) * 2;
  else if (h < 30) hs = Math.max(0, 70 - (30 - h) * 3);
  else hs = Math.max(0, 70 - (h - 60) * 3);
  const s = Math.round(ts * 0.6 + hs * 0.4);
  let l, c;
  if (s >= 80) { l = 'Comfortable'; c = '#22c55e'; }
  else if (s >= 60) { l = 'Acceptable'; c = '#4ade80'; }
  else if (s >= 40) { l = 'Uncomfortable'; c = '#fbbf24'; }
  else if (s >= 20) { l = 'Poor'; c = '#fb923c'; }
  else { l = 'Critical'; c = '#ef4444'; }
  return { score: s, label: l, color: c };
}

export function computeTrends(rows, gasField = 'gas_level') {
  if (rows.length < 3) return { temp: null, hum: null, gas: null };
  function slope(vals) {
    if (vals.length < 3) return null;
    const n = vals.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) {
      sx += vals[i].x; sy += vals[i].y;
      sxy += vals[i].x * vals[i].y; sxx += vals[i].x * vals[i].x;
    }
    const d = n * sxx - sx * sx;
    return d === 0 ? 0 : (n * sxy - sx * sy) / d;
  }
  const base = new Date(rows[0].created_at).getTime();
  const mf = (f) => rows.filter(r => r[f] != null).map(r => ({
    x: (new Date(r.created_at).getTime() - base) / 3600000, y: r[f],
  }));
  return { temp: slope(mf('temperature')), hum: slope(mf('humidity')), gas: slope(mf(gasField)) };
}

export function bucketize(rows, bucketMin, gasField = 'gas_level') {
  if (!bucketMin) return rows;
  const ms = bucketMin * 60 * 1000;
  const buckets = new Map();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    const key = Math.floor(t / ms) * ms;
    if (!buckets.has(key)) buckets.set(key, { temp: [], hum: [], gas: [], pres: [], light: [], motion: 0 });
    const b = buckets.get(key);
    if (r.temperature != null) b.temp.push(r.temperature);
    if (r.humidity != null) b.hum.push(r.humidity);
    const gv = r[gasField]; if (gv != null) b.gas.push(gv);
    if (r.pressure != null && r.pressure > 0) b.pres.push(r.pressure);
    if (r.light_value != null) b.light.push(r.light_value);
    if (r.motion) b.motion++;
  }
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([k, b]) => ({
    created_at: new Date(k).toISOString(),
    temperature: avg(b.temp), humidity: avg(b.hum),
    [gasField]: avg(b.gas), pressure: avg(b.pres),
    light_value: avg(b.light), motion: b.motion > 0,
  }));
}
