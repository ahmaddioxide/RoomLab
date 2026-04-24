import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

/**
 * ReUI-style grouped bar chart for comparing two rooms.
 *
 * @param {object} props
 * @param {string} props.title - Card title
 * @param {string} [props.description]
 * @param {Array} props.data - Array of { label, room1, room2 } or similar
 * @param {Array<{key: string, label: string, color: string}>} props.series
 * @param {string} [props.xKey='label']
 * @param {function} [props.yFormatter]
 * @param {string} [props.className]
 */
export default function CombinedBarChart({
  title,
  description,
  data,
  series,
  xKey = 'label',
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
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="oklch(0.28 0.012 55 / 0.5)" strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={yFormatter}
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              width={40}
            />
            <ChartTooltip
              cursor={{ fill: 'rgba(31,38,48,0.3)' }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="min-w-36 gap-2 bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
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
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
