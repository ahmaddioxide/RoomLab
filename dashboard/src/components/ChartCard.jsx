import { useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { CHART_TOOLTIP } from '../config';

const baseScaleOpts = {
  grid: { color: 'oklch(0.28 0.012 55 / 0.5)' },
  ticks: { color: 'oklch(0.62 0.02 65)', font: { family: 'Geist Variable, sans-serif', size: 11 } },
  border: { color: 'oklch(0.28 0.012 55)' },
};

export function yScale(color) {
  return { ...baseScaleOpts, position: 'left', ticks: { ...baseScaleOpts.ticks, color: color || '#7d8590' } };
}
export function yScaleRight(color) {
  return { ...baseScaleOpts, position: 'right', grid: { drawOnChartArea: false }, ticks: { ...baseScaleOpts.ticks, color: color || '#7d8590' } };
}

export function TimeSeriesChart({ datasets, scales, height = 220 }) {
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { display: false }, tooltip: CHART_TOOLTIP },
    scales: {
      x: {
        type: 'time',
        time: { tooltipFormat: 'MMM d, HH:mm' },
        ...baseScaleOpts,
        ticks: { ...baseScaleOpts.ticks, maxRotation: 0 },
      },
      ...scales,
    },
  }), [scales]);

  const data = useMemo(() => ({ datasets }), [datasets]);
  return <div className="chart-canvas-wrap"><Line data={data} options={options} /></div>;
}

export function BarChartCard({ labels, data: barData, accentRgb = '45,212,191', max = 100, yLabel, height = 220 }) {
  const maxVal = Math.max(...barData, 1);
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP, callbacks: { label: i => `${i.raw}%${yLabel ? ' ' + yLabel : ''}` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'oklch(0.62 0.02 65)', font: { family: 'Geist Variable, sans-serif', size: 10 } }, border: { color: 'oklch(0.28 0.012 55)' } },
      y: { min: 0, max, ticks: { color: 'oklch(0.62 0.02 65)', callback: v => v + '%', font: { family: 'Geist Variable, sans-serif', size: 10 } }, grid: { color: 'oklch(0.28 0.012 55 / 0.5)' }, border: { color: 'oklch(0.28 0.012 55)' } },
    },
  }), [max, yLabel]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [{
      data: barData,
      backgroundColor: barData.map(p => {
        const r = p / maxVal;
        return r >= 0.7 ? `rgba(${accentRgb},0.85)` : r >= 0.3 ? `rgba(${accentRgb},0.45)` : `rgba(${accentRgb},0.15)`;
      }),
      borderRadius: 3, barPercentage: 0.8,
    }],
  }), [labels, barData, accentRgb, maxVal]);

  return <div className="chart-canvas-wrap"><Bar data={chartData} options={options} /></div>;
}

export function ChartCard({ title, legend, children }) {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title">{title}</div>
        {legend && <div className="chart-legend">{legend}</div>}
      </div>
      {children}
    </div>
  );
}

export function LegendDot({ color, label }) {
  return <div className="legend-item"><div className="legend-dot" style={{ background: color }} />{label}</div>;
}
