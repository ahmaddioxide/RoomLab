import { useRef, useEffect } from 'react';
import { calcComfort, calcHeatIndex, calcDewPoint, fmt } from '../utils';

function drawGauge(canvas, score, color) {
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const rect = wrap.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cw = rect.width, ch = rect.height;
  ctx.clearRect(0, 0, cw, ch);
  if (score == null) return;

  const cx = cw / 2, cy = ch * 0.85;
  const r = Math.min(cw / 2, ch) * 0.82;
  const startA = Math.PI, lw = 12;
  const zones = [
    { from: 0, to: 0.2, c: '#ef4444' }, { from: 0.2, to: 0.4, c: '#fb923c' },
    { from: 0.4, to: 0.6, c: '#fbbf24' }, { from: 0.6, to: 0.8, c: '#4ade80' },
    { from: 0.8, to: 1, c: '#22c55e' },
  ];
  for (const z of zones) {
    ctx.beginPath(); ctx.arc(cx, cy, r, startA + z.from * Math.PI, startA + z.to * Math.PI);
    ctx.strokeStyle = z.c + '30'; ctx.lineWidth = lw; ctx.lineCap = 'butt'; ctx.stroke();
  }
  const sr = score / 100;
  ctx.beginPath(); ctx.arc(cx, cy, r, startA, startA + sr * Math.PI);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, startA, startA + sr * Math.PI);
  ctx.strokeStyle = color + '40'; ctx.lineWidth = lw + 8; ctx.lineCap = 'round'; ctx.stroke();
  const na = startA + sr * Math.PI, nl = r * 0.6;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * nl, cy + Math.sin(na) * nl);
  ctx.strokeStyle = '#e6edf3'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = '#e6edf3'; ctx.fill();
  ctx.font = '500 10px JetBrains Mono'; ctx.fillStyle = '#4a5260';
  ctx.textAlign = 'left'; ctx.fillText('0', cx - r - 4, cy + 14);
  ctx.textAlign = 'right'; ctx.fillText('100', cx + r + 4, cy + 14);
}

export default function ComfortSection({ temperature, humidity }) {
  const canvasRef = useRef(null);
  const comfort = calcComfort(temperature, humidity);
  const hi = calcHeatIndex(temperature, humidity);
  const dp = calcDewPoint(temperature, humidity);

  useEffect(() => {
    if (canvasRef.current) drawGauge(canvasRef.current, comfort.score, comfort.color);
  }, [temperature, humidity, comfort.score, comfort.color]);

  useEffect(() => {
    const handler = () => { if (canvasRef.current) drawGauge(canvasRef.current, comfort.score, comfort.color); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [comfort.score, comfort.color]);

  function zoneInfo(val, type) {
    if (val == null) return { text: '—', color: '' };
    if (type === 'temp') {
      if (val >= 20 && val <= 26) return { text: 'Ideal', color: '#22c55e' };
      if (val >= 17 && val <= 29) return { text: 'Okay', color: '#fbbf24' };
      if (val < 17) return { text: 'Cold', color: '#38bdf8' };
      return { text: 'Hot', color: '#ef4444' };
    }
    if (val >= 30 && val <= 60) return { text: 'Ideal', color: '#22c55e' };
    if (val >= 20 && val <= 70) return { text: 'Okay', color: '#fbbf24' };
    if (val < 20) return { text: 'Dry', color: '#fb923c' };
    return { text: 'Humid', color: '#38bdf8' };
  }

  const tz = zoneInfo(temperature, 'temp');
  const hz = zoneInfo(humidity, 'hum');

  return (
    <div className="comfort-section">
      <div className="comfort-gauge-card">
        <div className="card-label">Comfort Index</div>
        <div className="comfort-canvas-wrap"><canvas ref={canvasRef} /></div>
        <div className="comfort-score-text">
          <div className="comfort-score-num">{comfort.score ?? '—'}</div>
          <div className="comfort-score-label" style={{ color: comfort.color }}>{comfort.label}</div>
        </div>
      </div>
      <div className="comfort-details-card">
        <div className="comfort-detail"><div className="comfort-detail-label">Feels Like</div><div className="comfort-detail-value">{hi != null ? fmt(hi) + ' °C' : '—'}</div><div className="comfort-detail-hint">Heat index adjusted</div></div>
        <div className="comfort-detail"><div className="comfort-detail-label">Dew Point</div><div className="comfort-detail-value">{dp != null ? fmt(dp) + ' °C' : '—'}</div><div className="comfort-detail-hint">Condensation risk</div></div>
        <div className="comfort-detail"><div className="comfort-detail-label">Temp Zone</div><div className="comfort-detail-value" style={{ color: tz.color }}>{tz.text}</div><div className="comfort-detail-hint">Ideal: 20 – 26 °C</div></div>
        <div className="comfort-detail"><div className="comfort-detail-label">Humidity Zone</div><div className="comfort-detail-value" style={{ color: hz.color }}>{hz.text}</div><div className="comfort-detail-hint">Ideal: 30 – 60 %</div></div>
      </div>
    </div>
  );
}
