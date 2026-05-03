import { useRef, useEffect } from 'react';
import { calcComfort, calcHeatIndex, fmt } from '../utils';

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
    { from: 0, to: 0.2, c: '#c45d4e' }, { from: 0.2, to: 0.4, c: '#d4915c' },
    { from: 0.4, to: 0.6, c: '#d4b95c' }, { from: 0.6, to: 0.8, c: '#7bc47b' },
    { from: 0.8, to: 1, c: '#4da85e' },
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
  ctx.strokeStyle = 'oklch(0.93 0.01 75)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = 'oklch(0.93 0.01 75)'; ctx.fill();
  ctx.font = '600 10px Geist Variable'; ctx.fillStyle = 'oklch(0.52 0.015 60)';
  ctx.textAlign = 'left'; ctx.fillText('0', cx - r - 4, cy + 14);
  ctx.textAlign = 'right'; ctx.fillText('100', cx + r + 4, cy + 14);
}

export default function ComfortSection({ temperature, humidity }) {
  const canvasRef = useRef(null);
  const comfort = calcComfort(temperature, humidity);
  const hi = calcHeatIndex(temperature, humidity);

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
      if (val >= 20 && val <= 26) return { text: 'Ideal', color: '#4da85e' };
      if (val >= 17 && val <= 29) return { text: 'Okay', color: '#d4b95c' };
      if (val < 17) return { text: 'Cold', color: '#6ba8c4' };
      return { text: 'Hot', color: '#c45d4e' };
    }
    if (val >= 30 && val <= 60) return { text: 'Ideal', color: '#4da85e' };
    if (val >= 20 && val <= 70) return { text: 'Okay', color: '#d4b95c' };
    if (val < 20) return { text: 'Dry', color: '#d4915c' };
    return { text: 'Humid', color: '#6ba8c4' };
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
        <div className="comfort-detail">
          <div className="comfort-detail-label">Heat Index</div>
          <div className="comfort-detail-value">{hi != null ? fmt(hi) + ' °C' : '—'}</div>
          <div className="comfort-detail-hint">
            {hi != null && temperature != null
              ? (() => {
                  const diff = hi - temperature;
                  if (Math.abs(diff) < 0.3) return 'Matches actual temp';
                  return diff > 0
                    ? <span style={{ color: 'oklch(0.72 0.12 50)' }}>+{fmt(diff)} °C warmer than actual</span>
                    : <span style={{ color: 'oklch(0.65 0.10 225)' }}>{fmt(diff)} °C cooler than actual</span>;
                })()
              : 'How it feels'}
          </div>
        </div>
        <div className="comfort-detail"><div className="comfort-detail-label">Temp Zone</div><div className="comfort-detail-value" style={{ color: tz.color }}>{tz.text}</div><div className="comfort-detail-hint">Ideal: 20 – 26 °C</div></div>
        <div className="comfort-detail"><div className="comfort-detail-label">Humidity Zone</div><div className="comfort-detail-value" style={{ color: hz.color }}>{hz.text}</div><div className="comfort-detail-hint">Ideal: 30 – 60 %</div></div>
      </div>
    </div>
  );
}
