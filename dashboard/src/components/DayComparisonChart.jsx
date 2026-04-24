import { useState, useMemo, useCallback } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { hourAmPm } from '../utils';

const PARAM_OPTIONS = {
  temperature:  { label: 'Temperature', unit: '°C', color: 'oklch(0.75 0.14 55)' },
  humidity:     { label: 'Humidity', unit: '%', color: 'oklch(0.70 0.10 220)' },
};

const PARAM_OPTIONS_R1 = {
  ...PARAM_OPTIONS,
  gas_level:    { label: 'Gas Level', unit: '', color: 'oklch(0.68 0.12 310)' },
};

const PARAM_OPTIONS_R2 = {
  ...PARAM_OPTIONS,
  air_quality:  { label: 'Air Quality', unit: '', color: 'oklch(0.68 0.12 310)' },
  pressure:     { label: 'Pressure', unit: 'hPa', color: 'oklch(0.70 0.11 155)' },
  light_value:  { label: 'Light Level', unit: '', color: 'oklch(0.78 0.13 85)' },
};

function getAvailableDays(rows) {
  const daySet = new Map();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!daySet.has(key)) {
      daySet.set(key, { key, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), count: 0 });
    }
    daySet.get(key).count++;
  }
  return [...daySet.values()]
    .filter(d => d.count >= 3) // need at least a few data points
    .sort((a, b) => b.date - a.date);
}

function formatDayLabel(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - date) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function DayComparisonChart({ rows, room }) {
  const paramMap = room === 'room1' ? PARAM_OPTIONS_R1 : PARAM_OPTIONS_R2;
  const paramKeys = Object.keys(paramMap);
  const [activeParam, setActiveParam] = useState(paramKeys[0]);
  const [compareIdx, setCompareIdx] = useState(1); // index into availableDays (0 = today)

  const availableDays = useMemo(() => getAvailableDays(rows), [rows]);

  // Clamp compareIdx
  const safeIdx = Math.min(Math.max(compareIdx, 1), availableDays.length - 1);
  const todayEntry = availableDays[0];
  const compareEntry = availableDays[safeIdx];

  const shiftDay = useCallback((dir) => {
    setCompareIdx(prev => {
      const next = prev + dir;
      return Math.min(Math.max(next, 1), availableDays.length - 1);
    });
  }, [availableDays.length]);

  const param = paramMap[activeParam];

  // Build hour-aligned data for both days
  const chartData = useMemo(() => {
    if (!todayEntry || !compareEntry) return [];
    const todayStart = todayEntry.date.getTime();
    const todayEnd = todayStart + 86400000;
    const compStart = compareEntry.date.getTime();
    const compEnd = compStart + 86400000;

    // Group by fractional hour
    const hourMap = {};
    for (let h = 0; h < 24; h++) {
      hourMap[h] = { hour: h, label: hourAmPm(h) };
    }

    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const val = r[activeParam];
      if (val == null) continue;
      const d = new Date(r.created_at);
      const h = d.getHours();

      if (t >= todayStart && t < todayEnd) {
        if (!hourMap[h].todayVals) hourMap[h].todayVals = [];
        hourMap[h].todayVals.push(val);
      } else if (t >= compStart && t < compEnd) {
        if (!hourMap[h].compVals) hourMap[h].compVals = [];
        hourMap[h].compVals.push(val);
      }
    }

    return Object.values(hourMap).map(entry => ({
      hour: entry.hour,
      label: entry.label,
      today: entry.todayVals?.length
        ? +(entry.todayVals.reduce((a, b) => a + b, 0) / entry.todayVals.length).toFixed(1)
        : undefined,
      compare: entry.compVals?.length
        ? +(entry.compVals.reduce((a, b) => a + b, 0) / entry.compVals.length).toFixed(1)
        : undefined,
    }));
  }, [rows, todayEntry, compareEntry, activeParam]);

  // Current hour marker
  const currentHour = new Date().getHours();

  const chartConfig = useMemo(() => ({
    today: { label: `Today`, color: param.color },
    compare: { label: compareEntry ? formatDayLabel(compareEntry.date) : 'Previous', color: `${param.color}` },
  }), [param.color, compareEntry]);

  if (!rows.length || availableDays.length < 2) {
    return (
      <Card className="w-full overflow-visible bg-[var(--bg)] border-[var(--border)] text-[var(--text)]">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm font-semibold text-[var(--text)]">Day Comparison</CardTitle>
          <CardDescription className="text-xs text-[var(--text-dim)]">
            Not enough data to compare — need at least 2 days of readings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-visible bg-[var(--bg)] border-[var(--border)] text-[var(--text)]">
      <CardHeader className="pb-2 px-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm font-semibold text-[var(--text)]">Day Comparison</CardTitle>
            <CardDescription className="text-xs text-[var(--text-dim)]">
              Today vs {compareEntry ? formatDayLabel(compareEntry.date) : '—'}
            </CardDescription>
          </div>
          {/* Day picker */}
          <div className="day-picker">
            <button
              className="day-picker-btn"
              onClick={() => shiftDay(1)}
              disabled={safeIdx >= availableDays.length - 1}
              aria-label="Older day"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="day-picker-label">
              {compareEntry ? formatDayLabel(compareEntry.date) : '—'}
            </span>
            <button
              className="day-picker-btn"
              onClick={() => shiftDay(-1)}
              disabled={safeIdx <= 1}
              aria-label="Newer day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {/* Parameter tabs */}
        <div className="comparison-tabs">
          {paramKeys.map(k => (
            <button
              key={k}
              className={`comparison-tab${activeParam === k ? ' active' : ''}`}
              onClick={() => setActiveParam(k)}
              style={activeParam === k ? { borderColor: paramMap[k].color, color: paramMap[k].color } : undefined}
            >
              {paramMap[k].label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-4">
        <ChartContainer config={chartConfig} className="aspect-auto h-[200px] sm:h-[260px] w-full">
          <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="oklch(0.28 0.012 55 / 0.5)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              interval={2}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              width={45}
              tickFormatter={v => param.unit ? `${v}${param.unit}` : v}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  className="min-w-44 gap-2 bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
                  labelFormatter={(value) => (
                    <span className="text-xs font-medium text-[var(--text-dim)]">{value}</span>
                  )}
                  formatter={(value, name) => {
                    const cfg = chartConfig[name];
                    return (
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{
                              background: cfg?.color,
                              opacity: name === 'compare' ? 0.5 : 1,
                            }}
                          />
                          <span className="text-[var(--text-dim)] text-xs">
                            {cfg?.label || name}
                          </span>
                        </div>
                        <span className="font-semibold tabular-nums text-[var(--text)] text-xs">
                          {value != null ? `${value}${param.unit ? ' ' + param.unit : ''}` : '—'}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            {/* Current hour indicator */}
            <ReferenceLine
              x={hourAmPm(currentHour)}
              stroke="oklch(0.93 0.01 75 / 0.2)"
              strokeDasharray="4 4"
              label={false}
            />
            {/* Compare day — dashed, semi-transparent */}
            <Line
              dataKey="compare"
              type="monotone"
              stroke={param.color}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              strokeOpacity={0.45}
              dot={false}
              activeDot={{ r: 3, fill: param.color, fillOpacity: 0.5 }}
              connectNulls
            />
            {/* Today — solid, prominent */}
            <Line
              dataKey="today"
              type="monotone"
              stroke={param.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: param.color }}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
        {/* Legend */}
        <div className="comparison-legend">
          <div className="comparison-legend-item">
            <span className="comparison-legend-line" style={{ background: param.color }} />
            Today
          </div>
          <div className="comparison-legend-item">
            <span className="comparison-legend-line dashed" style={{ background: param.color, opacity: 0.45 }} />
            {compareEntry ? formatDayLabel(compareEntry.date) : 'Previous'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
