import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { HistoryList } from '@/components/history/HistoryList';
import { WeeklyChart } from '@/components/history/WeeklyChart';
import { CalendarView } from '@/components/history/CalendarView';
import { WeeklyPillarChart } from '@/components/tracking/WeeklyPillarChart';
import { useRecentEntries, useDeleteEntry, useDailyGoals, useSettings } from '@/hooks/useProteinData';
import {
  useRecentSleepEntries,
  useRecentTrainingEntries,
  useSleepChartData,
} from '@/hooks/useTrackingData';
import { updateFoodEntry } from '@/db';
import { triggerSync } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import type { FoodEntry, SleepEntry } from '@/types';
import { format, subDays, startOfDay } from 'date-fns';

type PillarType = 'protein' | 'sleep' | 'training';

// Training only has List + Week tabs (no calendar — it's just y/n per day)

const PILLAR_LABELS: Record<PillarType, string> = {
  protein: 'Protein',
  sleep: 'Sleep',
  training: 'Training',
};

function TrainingWeekChart({ trainingEntries }: { trainingEntries: { date: string }[] }) {
  const data = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const trainedDates = new Set(trainingEntries.map((e) => e.date));

    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      return {
        date: dateStr,
        day: format(date, 'EEE'),
        value: trainedDates.has(dateStr) ? 1 : 0,
        goal: 1,
        goalMet: trainedDates.has(dateStr),
        isToday: dateStr === todayStr,
      };
    });
  }, [trainingEntries]);

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm">
      <h4 className="text-sm font-semibold mb-3">This Week</h4>
      <div className="flex justify-between gap-1">
        {data.map((d) => (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                d.goalMet
                  ? 'bg-emerald-500 text-white'
                  : 'bg-muted text-muted-foreground',
                d.isToday && !d.goalMet && 'ring-2 ring-emerald-500/50'
              )}
            >
              {d.goalMet ? '✓' : '—'}
            </div>
            <span className={cn(
              'text-[10px]',
              d.isToday ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}>
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SleepCalendar({ sleepEntries, sleepGoal }: { sleepEntries: SleepEntry[]; sleepGoal: number }) {
  // Simple sleep heatmap calendar — reusing the weekly chart for now
  const sleepChartData = useSleepChartData(sleepEntries, sleepGoal, 7);

  return (
    <WeeklyPillarChart
      data={sleepChartData}
      label="Sleep Duration"
      unit="h"
      color="#3b82f6"
      bgColor="#dbeafe"
    />
  );
}

export function InsightsDetail() {
  const { pillar } = useParams<{ pillar: string }>();
  const navigate = useNavigate();
  const pillarType = (pillar || 'protein') as PillarType;

  // Redirect invalid pillars
  if (!['protein', 'sleep', 'training'].includes(pillarType)) {
    navigate('/insights', { replace: true });
    return null;
  }

  return <InsightsDetailContent pillar={pillarType} />;
}

function InsightsDetailContent({ pillar }: { pillar: PillarType }) {
  const navigate = useNavigate();

  // Tab state — protein/sleep have 3 tabs, training has 2
  const [activeTab, setActiveTab] = useState<string>(pillar === 'training' ? 'list' : 'week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  // Data hooks
  const entries = useRecentEntries(180);
  const sleepEntries = useRecentSleepEntries(180);
  const trainingEntries = useRecentTrainingEntries(180);
  const deleteEntry = useDeleteEntry();
  const dailyGoals = useDailyGoals();
  const { settings } = useSettings();

  // Swipe handling
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleEdit = useCallback(async (entry: FoodEntry) => {
    if (!entry.id) return;
    await updateFoodEntry(entry.id, {
      foodName: entry.foodName,
      protein: entry.protein,
      calories: entry.calories,
      date: entry.date,
      consumedAt: entry.consumedAt,
      updatedAt: new Date(),
    });
    triggerSync();
  }, []);

  const handlePrevWeek = useCallback(() => setWeekOffset((prev) => prev - 1), []);
  const handleNextWeek = useCallback(() => setWeekOffset((prev) => Math.min(prev + 1, 0)), []);
  const handlePrevMonth = useCallback(() => setMonthOffset((prev) => prev - 1), []);
  const handleNextMonth = useCallback(() => setMonthOffset((prev) => Math.min(prev + 1, 0)), []);

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - swipeStartX.current;
    const deltaY = e.touches[0].clientY - swipeStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      setIsSwiping(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
    const SWIPE_THRESHOLD = 50;

    if (activeTab === 'week') {
      if (deltaX > SWIPE_THRESHOLD) handlePrevWeek();
      else if (deltaX < -SWIPE_THRESHOLD) handleNextWeek();
    } else if (activeTab === 'month') {
      if (deltaX > SWIPE_THRESHOLD) handlePrevMonth();
      else if (deltaX < -SWIPE_THRESHOLD) handleNextMonth();
    }
    setIsSwiping(false);
  };

  // Tab definitions per pillar
  const tabs = pillar === 'training'
    ? [
        { value: 'list', label: 'List' },
        { value: 'week', label: 'Week' },
      ]
    : [
        { value: 'list', label: 'List' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ];

  const sleepGoal = settings.sleepGoalMinutes ?? 480;

  return (
    <div className="min-h-full">
      {/* Back button + title */}
      <div className="px-4 pt-2 pb-2 flex items-center gap-2">
        <button
          onClick={() => navigate('/insights')}
          className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">{PILLAR_LABELS[pillar]}</h2>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 pb-4">
        <div className="bg-muted/50 p-1 rounded-xl flex">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                activeTab === tab.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div
        className="px-4"
        onTouchStart={activeTab !== 'list' ? handleTouchStart : undefined}
        onTouchMove={activeTab !== 'list' ? handleTouchMove : undefined}
        onTouchEnd={activeTab !== 'list' ? handleTouchEnd : undefined}
      >
        {/* List tab — all pillars together regardless of which detail we're in */}
        {activeTab === 'list' && (
          <HistoryList
            entries={entries}
            sleepEntries={settings.sleepTrackingEnabled ? sleepEntries : []}
            trainingEntries={settings.trainingTrackingEnabled ? trainingEntries : []}
            goals={dailyGoals}
            defaultGoal={settings.defaultGoal}
            calorieTrackingEnabled={settings.calorieTrackingEnabled}
            sleepGoalMinutes={settings.sleepGoalMinutes}
            onDelete={deleteEntry}
            onEdit={handleEdit}
          />
        )}

        {/* Week tab — pillar-specific */}
        {activeTab === 'week' && pillar === 'protein' && (
          <WeeklyChart
            entries={entries}
            goal={settings.defaultGoal}
            calorieGoal={settings.calorieGoal}
            calorieTrackingEnabled={settings.calorieTrackingEnabled}
            mpsTrackingEnabled={settings.mpsTrackingEnabled}
            weekOffset={weekOffset}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            isSwiping={isSwiping}
          />
        )}

        {activeTab === 'week' && pillar === 'sleep' && (
          <SleepCalendar sleepEntries={sleepEntries} sleepGoal={sleepGoal} />
        )}

        {activeTab === 'week' && pillar === 'training' && (
          <TrainingWeekChart trainingEntries={trainingEntries} />
        )}

        {/* Month tab — protein and sleep only */}
        {activeTab === 'month' && pillar === 'protein' && (
          <CalendarView
            entries={entries}
            goals={dailyGoals}
            defaultGoal={settings.defaultGoal}
            mpsTrackingEnabled={settings.mpsTrackingEnabled}
            weekStartsOn={settings.weekStartsOn}
            monthOffset={monthOffset}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        )}

        {activeTab === 'month' && pillar === 'sleep' && (
          <SleepCalendar sleepEntries={sleepEntries} sleepGoal={sleepGoal} />
        )}
      </div>
    </div>
  );
}
