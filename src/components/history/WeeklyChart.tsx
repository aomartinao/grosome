import { useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Dumbbell, Flame } from 'lucide-react';
import { calculateMPSHits } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { FoodEntry } from '@/types';

interface WeeklyChartProps {
  entries: FoodEntry[];
  goal: number;
  calorieGoal?: number;
  calorieTrackingEnabled?: boolean;
  mpsTrackingEnabled?: boolean;
}

// Meal time categories based on consumedAt hour
function getMealType(entry: FoodEntry): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const time = entry.consumedAt || entry.createdAt;
  const hour = time.getHours();

  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  return 'dinner'; // 18-5
}

// Meal colors - harmonious palette
const MEAL_COLORS = {
  breakfast: 'hsl(45 93% 47%)',   // Warm yellow/orange
  lunch: 'hsl(142 76% 36%)',      // Green
  snack: 'hsl(262 83% 58%)',      // Purple
  dinner: 'hsl(221 83% 53%)',     // Blue
};

interface DayData {
  date: string;
  day: string;
  breakfast: number;
  lunch: number;
  snack: number;
  dinner: number;
  totalProtein: number;
  totalCalories: number;
  goalMet: boolean;
  mpsHits: number;
  isToday: boolean;
}

export function WeeklyChart({
  entries,
  goal,
  calorieTrackingEnabled = false,
  mpsTrackingEnabled = true,
}: WeeklyChartProps) {
  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const data: DayData[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayEntries = entries.filter((e) => e.date === dateStr);

      // Group by meal type
      const mealTotals = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
      let totalCalories = 0;

      for (const entry of dayEntries) {
        const mealType = getMealType(entry);
        mealTotals[mealType] += entry.protein;
        totalCalories += entry.calories || 0;
      }

      const totalProtein = Object.values(mealTotals).reduce((a, b) => a + b, 0);

      // Calculate MPS hits for this day
      const mpsHits = calculateMPSHits(dayEntries).length;

      data.push({
        date: dateStr,
        day: format(date, 'EEE'),
        ...mealTotals,
        totalProtein,
        totalCalories,
        goalMet: totalProtein >= goal,
        mpsHits,
        isToday: dateStr === todayStr,
      });
    }

    return data;
  }, [entries, goal]);

  // Calculate stats
  const totalProtein = chartData.reduce((sum, d) => sum + d.totalProtein, 0);
  const avgProtein = Math.round(totalProtein / 7);
  const goalMetDays = chartData.filter(d => d.goalMet).length;
  const totalMpsHits = chartData.reduce((sum, d) => sum + d.mpsHits, 0);
  const totalCalories = chartData.reduce((sum, d) => sum + d.totalCalories, 0);
  const avgCalories = Math.round(totalCalories / 7);

  // Calculate week-over-week trend (compare to previous week if data available)
  const thisWeekTotal = totalProtein;
  const prevWeekEntries = entries.filter(e => {
    const entryDate = new Date(e.date);
    const weekAgo = subDays(new Date(), 7);
    const twoWeeksAgo = subDays(new Date(), 14);
    return entryDate >= twoWeeksAgo && entryDate < weekAgo;
  });
  const prevWeekTotal = prevWeekEntries.reduce((sum, e) => sum + e.protein, 0);

  const trendPercent = prevWeekTotal > 0
    ? Math.round(((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100)
    : 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0]?.payload as DayData;
    if (!data) return null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold mb-2">{format(new Date(data.date), 'EEEE, MMM d')}</p>
        <div className="space-y-1">
          {data.breakfast > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Breakfast</span>
              <span className="font-medium">{data.breakfast}g</span>
            </div>
          )}
          {data.lunch > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Lunch</span>
              <span className="font-medium">{data.lunch}g</span>
            </div>
          )}
          {data.snack > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Snack</span>
              <span className="font-medium">{data.snack}g</span>
            </div>
          )}
          {data.dinner > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Dinner</span>
              <span className="font-medium">{data.dinner}g</span>
            </div>
          )}
          <div className="border-t pt-1 mt-1 flex justify-between gap-4">
            <span className="font-medium">Total</span>
            <span className={cn("font-bold", data.goalMet ? "text-green-600" : "text-primary")}>
              {data.totalProtein}g
            </span>
          </div>
          {calorieTrackingEnabled && data.totalCalories > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Calories</span>
              <span className="font-medium text-amber-600">{data.totalCalories} kcal</span>
            </div>
          )}
          {mpsTrackingEnabled && data.mpsHits > 0 && (
            <div className="flex justify-between gap-4 items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Dumbbell className="h-3 w-3" /> MPS hits
              </span>
              <span className="font-medium text-purple-600">{data.mpsHits}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calculate max for Y axis to ensure goal line is always visible
  const maxProtein = Math.max(...chartData.map(d => d.totalProtein), goal);
  const yAxisMax = Math.ceil(maxProtein * 1.1 / 10) * 10; // Round up to nearest 10 with 10% padding

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1">
            <span className="text-2xl font-bold text-primary">{avgProtein}g</span>
            {trendPercent !== 0 && (
              <span className={cn(
                "text-xs flex items-center",
                trendPercent > 0 ? "text-green-600" : "text-red-500"
              )}>
                {trendPercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Daily avg</p>
        </div>
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1">
            <Flame className="h-5 w-5 text-green-600" />
            <span className="text-2xl font-bold text-green-600">{goalMetDays}</span>
            <span className="text-lg text-muted-foreground">/7</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Goals hit</p>
        </div>
        {mpsTrackingEnabled ? (
          <div className="bg-card rounded-2xl p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1">
              <Dumbbell className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold text-purple-600">{totalMpsHits}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">MPS hits</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-4 text-center shadow-sm">
            <span className="text-2xl font-bold text-foreground">{totalProtein}g</span>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </div>
        )}
      </div>

      {/* Calories summary if tracking */}
      {calorieTrackingEnabled && totalCalories > 0 && (
        <div className="bg-card rounded-2xl p-3 shadow-sm flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Avg calories</span>
          <span className="font-semibold text-amber-600">{avgCalories} kcal/day</span>
        </div>
      )}

      {/* Chart */}
      <div className="bg-card rounded-2xl p-4 shadow-sm">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                width={40}
                domain={[0, yAxisMax]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
              <ReferenceLine
                y={goal}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `${goal}g`,
                  position: 'right',
                  fontSize: 10,
                  fill: 'hsl(var(--destructive))',
                }}
              />
              {/* Stacked bars by meal type */}
              <Bar dataKey="breakfast" stackId="protein" fill={MEAL_COLORS.breakfast} radius={[0, 0, 0, 0]} />
              <Bar dataKey="lunch" stackId="protein" fill={MEAL_COLORS.lunch} radius={[0, 0, 0, 0]} />
              <Bar dataKey="snack" stackId="protein" fill={MEAL_COLORS.snack} radius={[0, 0, 0, 0]} />
              <Bar dataKey="dinner" stackId="protein" fill={MEAL_COLORS.dinner} radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    stroke={entry.isToday ? 'hsl(var(--primary))' : 'transparent'}
                    strokeWidth={entry.isToday ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: MEAL_COLORS.breakfast }} />
            <span>Breakfast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: MEAL_COLORS.lunch }} />
            <span>Lunch</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: MEAL_COLORS.snack }} />
            <span>Snack</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: MEAL_COLORS.dinner }} />
            <span>Dinner</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 border-t-2 border-dashed border-destructive" />
            <span>Goal</span>
          </div>
        </div>
      </div>

      {/* Weekly insight */}
      {goalMetDays >= 5 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 font-medium">
            🎯 Great week! You hit your goal {goalMetDays} out of 7 days.
          </p>
        </div>
      )}
      {goalMetDays < 3 && totalProtein > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-amber-700 font-medium">
            💪 Room to grow - try adding a protein-rich snack to your routine.
          </p>
        </div>
      )}
    </div>
  );
}
