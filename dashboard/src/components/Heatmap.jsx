import React from 'react';
import { hourAmPm } from '../utils';

export default function Heatmap({ rows, accentRgb = '45,212,191' }) {
  if (!rows.length) return <div style={{ color: 'var(--text-faint)', padding: '16px 0' }}>No motion data</div>;

  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  const dayLabels = days.map(d => d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }));

  const grid = {};
  for (const r of rows) {
    const d = new Date(r.created_at);
    const di = days.findIndex(day => d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate());
    if (di === -1) continue;
    const h = d.getHours(), key = `${di}-${h}`;
    if (!grid[key]) grid[key] = { motion: 0, total: 0 };
    grid[key].total++;
    if (r.motion) grid[key].motion++;
  }

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="heatmap-header-cell">{h % 6 === 0 ? hourAmPm(h) : ''}</div>
        ))}
        {days.map((_, di) => (
          <React.Fragment key={di}>
            <div className="heatmap-day-label">{dayLabels[di]}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const cell = grid[`${di}-${h}`];
              let bg, tip;
              if (!cell || cell.total === 0) {
                bg = 'rgba(31,38,48,0.5)';
                tip = `${dayLabels[di]} ${hourAmPm(h)} — no data`;
              } else {
                const ratio = cell.motion / cell.total;
                bg = `rgba(${accentRgb},${(ratio * 0.85 + 0.05).toFixed(2)})`;
                tip = `${dayLabels[di]} ${hourAmPm(h)} — ${Math.round(ratio * 100)}% active`;
              }
              return <div key={h} className="heatmap-cell" style={{ background: bg }} data-tooltip={tip} />;
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        <div className="heatmap-legend-bar">
          {[0.05, 0.2, 0.4, 0.6, 0.85].map((o, i) => (
            <span key={i} style={{ background: i === 0 ? `rgba(${accentRgb},0.05)` : `rgba(${accentRgb},${o})`, border: i === 0 ? '1px solid var(--border)' : 'none' }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
