import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beef, Moon, Dumbbell, Sparkles } from 'lucide-react';
import { useSettings, useRecentEntries, useStreak } from '@/hooks/useProteinData';
import {
  useRecentSleepEntries,
  useRecentTrainingEntries,
  useSleepChartData,
  useProteinChartData,
} from '@/hooks/useTrackingData';
import { PillarSummaryCard } from '@/components/insights/PillarSummaryCard';
import { StreakCard } from '@/components/insights/StreakCard';
import { cn } from '@/lib/utils';

export function Insights() {
  const [timeRange, setTimeRange] = useState<7 | 30>(7);
  const navigate = useNavigate();
  const { settings } = useSettings();

  const foodEntries = useRecentEntries(timeRange);
  const sleepEntries = useRecentSleepEntries(timeRange);
  const trainingEntries = useRecentTrainingEntries(timeRange);

  // Also fetch 30 days for streak/consistency calculation
  const allEntries = useRecentEntries(30);
  const streak = useStreak(allEntries, settings.defaultGoal);

  const sleepGoal = settings.sleepGoalMinutes ?? 480;
  const proteinGoal = settings.defaultGoal;

  // Protein stats
  const proteinStats = useMemo(() => {
    const dailyTotals = new Map<string, number>();
    for (const e of foodEntries) {
      dailyTotals.set(e.date, (dailyTotals.get(e.date) ?? 0) + e.protein);
    }
    const values = Array.from(dailyTotals.values());
    const avg = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
    const goalMet = values.filter((v) => v >= proteinGoal).length;
    return { avg, goalMet, days: values.length };
  }, [foodEntries, proteinGoal]);

  // Sleep stats
  const sleepStats = useMemo(() => {
    const dailyTotals = new Map<string, number>();
    for (const e of sleepEntries) {
      dailyTotals.set(e.date, (dailyTotals.get(e.date) ?? 0) + e.duration);
    }
    const values = Array.from(dailyTotals.values());
    const avgMinutes = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
    const goalMet = values.filter((v) => v >= sleepGoal).length;
    return { avgMinutes, goalMet, days: values.length };
  }, [sleepEntries, sleepGoal]);

  // Training stats
  const trainingStats = useMemo(() => {
    const uniqueDays = new Set(trainingEntries.map((e) => e.date));
    return { daysTrained: uniqueDays.size };
  }, [trainingEntries]);

  // Trend (compare current 7d avg to previous 7d avg)
  const trend = useMemo(() => {
    if (allEntries.length === 0) return 'new' as const;
    const dailyTotals = new Map<string, number>();
    for (const e of allEntries) {
      dailyTotals.set(e.date, (dailyTotals.get(e.date) ?? 0) + e.protein);
    }
    const sorted = Array.from(dailyTotals.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const recent = sorted.slice(0, 7);
    const previous = sorted.slice(7, 14);
    if (recent.length < 3 || previous.length < 3) return 'new' as const;
    const recentAvg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
    const prevAvg = previous.reduce((s, [, v]) => s + v, 0) / previous.length;
    const diff = recentAvg - prevAvg;
    if (diff > 10) return 'improving' as const;
    if (diff < -10) return 'declining' as const;
    return 'consistent' as const;
  }, [allEntries]);

  // Consistency
  const consistencyPercent = useMemo(() => {
    const dailyTotals = new Map<string, number>();
    for (const e of allEntries) {
      dailyTotals.set(e.date, (dailyTotals.get(e.date) ?? 0) + e.protein);
    }
    const values = Array.from(dailyTotals.values());
    if (values.length === 0) return 0;
    const goalMet = values.filter((v) => v >= proteinGoal).length;
    return (goalMet / values.length) * 100;
  }, [allEntries, proteinGoal]);

  // Chart data (always 7 days for the mini charts)
  const proteinChartData = useProteinChartData(foodEntries, proteinGoal, 7);
  const sleepChartData = useSleepChartData(sleepEntries, sleepGoal, 7);

  const formatSleepHours = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const totalDays = Math.max(proteinStats.days, sleepStats.days, 1);
  const hasLittleData = totalDays < 3;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 pb-28">
      {/* Time Range Toggle */}
      <div className="flex items-center justify-end">
        <div className="flex rounded-xl bg-muted p-1">
          {([7, 30] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-lg transition-all duration-200',
                timeRange === range
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {/* Encouragement banner for new users */}
      {hasLittleData && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Keep logging to unlock trends and insights. A few more days of data will bring this to life.
          </p>
        </div>
      )}

      {/* Pillar Cards */}
      <PillarSummaryCard
        icon={Beef}
        iconColor="text-amber-500"
        iconBgColor="bg-amber-500/15"
        title="Protein"
        stat={`${proteinStats.avg}g`}
        statLabel="avg / day"
        goalsMet={`${proteinStats.goalMet}/${proteinStats.days}`}
        chartData={proteinChartData}
        chartColor="#f59e0b"
        chartBgColor="#fef3c7"
        chartUnit="g"
        trend={trend}
        onClick={() => navigate('/insights/protein')}
      />

      {settings.sleepTrackingEnabled && (
        <PillarSummaryCard
          icon={Moon}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-500/15"
          title="Sleep"
          stat={formatSleepHours(sleepStats.avgMinutes)}
          statLabel="avg / night"
          goalsMet={`${sleepStats.goalMet}/${sleepStats.days}`}
          chartData={sleepChartData}
          chartColor="#3b82f6"
          chartBgColor="#dbeafe"
          chartUnit="h"
          onClick={() => navigate('/insights/sleep')}
        />
      )}

      {settings.trainingTrackingEnabled && (
        <PillarSummaryCard
          icon={Dumbbell}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-500/15"
          title="Training"
          stat={`${trainingStats.daysTrained}`}
          statLabel={`days / ${timeRange}d`}
          goalsMet=""
          onClick={() => navigate('/insights/training')}
        />
      )}

      {/* Streak Card */}
      <StreakCard
        currentStreak={streak.currentStreak}
        longestStreak={streak.longestStreak}
        consistencyPercent={consistencyPercent}
      />
    </div>
  );
}
