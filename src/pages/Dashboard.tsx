import { DailyProgress } from '@/components/tracking/DailyProgress';
import { useTodayEntries, useSettings, useStreak, useRecentEntries } from '@/hooks/useProteinData';

export function Dashboard() {
  const todayEntries = useTodayEntries();
  const recentEntries = useRecentEntries(30);
  const { settings } = useSettings();
  const streak = useStreak(recentEntries, settings.defaultGoal);

  return (
    <div className="min-h-full">
      <DailyProgress
        entries={todayEntries}
        goal={settings.defaultGoal}
        calorieGoal={settings.calorieGoal}
        calorieTrackingEnabled={settings.calorieTrackingEnabled}
        mpsTrackingEnabled={settings.mpsTrackingEnabled}
        streak={streak}
      />
    </div>
  );
}
