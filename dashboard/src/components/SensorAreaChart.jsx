import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

/**
 * ReUI-style stacked area chart for single-room sensor data.
 *
 * @param {object} props
 * @param {string} props.title - Card title
 * @param {string} [props.description] - Card subtitle
 * @param {Array} props.data - Array of { time, ...metrics }
 * @param {Array<{key: string, label: string, color: string}>} props.series - Which keys to plot
 * @param {string} [props.xKey='time'] - x-axis key
 * @param {function} [props.xFormatter] - x-axis tick formatter
 * @param {function} [props.yFormatter] - y-axis value formatter
 * @param {string} [props.className]
 */
export default function SensorAreaChart({
  title,
  description,
  data,
  series,
  xKey = 'time',
  xFormatter,
  yFormatter,
  className,
}) {
  const chartConfig = useMemo(() => {
    const cfg = {};
    for (const s of series) {
      cfg[s.key] = { label: s.label, color: s.color };
    }
    return cfg;
  }, [series]);

  if (!data?.length) return null;

  return (
    <Card className={`w-full bg-[var(--bg)] border-[var(--border)] text-[var(--text)] ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--text)]">{title}</CardTitle>
        {description && <CardDescription className="text-xs text-[var(--text-dim)]">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-1 sm:px-2 pb-4">
        <ChartContainer config={chartConfig} className="aspect-auto h-[180px] sm:h-[220px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="oklch(0.28 0.012 55 / 0.5)" strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={xFormatter}
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              minTickGap={40}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={yFormatter}
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="min-w-36 gap-2 bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
                  labelFormatter={(value) => (
                    <span className="text-xs font-medium text-[var(--text-dim)]">
                      {xFormatter ? xFormatter(value) : value}
                    </span>
                  )}
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: chartConfig[name]?.color }}
                        />
                        <span className="text-[var(--text-dim)] text-xs">
                          {chartConfig[name]?.label || name}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums text-[var(--text)] text-xs">
                        {typeof value === 'number' ? value.toFixed(1) : value}
                      </span>
                    </div>
                  )}
                />
              }
            />
            {series.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                fill={`url(#grad-${s.key})`}
                fillOpacity={1}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: s.color }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
