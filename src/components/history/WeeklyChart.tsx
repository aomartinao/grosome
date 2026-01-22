import { useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { FoodEntry } from '@/types';

interface WeeklyChartProps {
  entries: FoodEntry[];
  goal: number;
}

export function WeeklyChart({ entries, goal }: WeeklyChartProps) {
  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayEntries = entries.filter((e) => e.date === dateStr);
      const totalProtein = dayEntries.reduce((sum, e) => sum + e.protein, 0);

      data.push({
        date: dateStr,
        day: format(date, 'EEE'),
        protein: totalProtein,
        goalMet: totalProtein >= goal,
      });
    }

    return data;
  }, [entries, goal]);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <ReferenceLine
            y={goal}
            stroke="hsl(var(--primary))"
            strokeDasharray="5 5"
            strokeWidth={2}
          />
          <Bar dataKey="protein" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.goalMet
                    ? 'hsl(142 76% 36%)'
                    : 'hsl(var(--primary))'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary" />
          <span>Protein</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-600" />
          <span>Goal met</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 border-t-2 border-dashed border-primary" />
          <span>Goal ({goal}g)</span>
        </div>
      </div>
    </div>
  );
}
