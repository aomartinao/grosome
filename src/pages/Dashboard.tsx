import { useState, useMemo } from 'react';
import { format, subDays, addDays, isToday, startOfDay } from 'date-fns';
import { DailyProgress } from '@/components/tracking/DailyProgress';
import { useSettings, useStreak, useRecentEntries } from '@/hooks/useProteinData';

export function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const recentEntries = useRecentEntries(30);
  const { settings } = useSettings();
  const streak = useStreak(recentEntries, settings.defaultGoal);

  // Filter entries for the selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const entriesForDate = useMemo(
    () => recentEntries.filter((e) => e.date === selectedDateStr),
    [recentEntries, selectedDateStr]
  );

  const handlePrevDay = () => {
    setSelectedDate((d) => subDays(d, 1));
  };

  const handleNextDay = () => {
    const tomorrow = addDays(startOfDay(new Date()), 1);
    if (selectedDate < tomorrow) {
      setSelectedDate((d) => addDays(d, 1));
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const canGoNext = !isToday(selectedDate);
  const isSelectedToday = isToday(selectedDate);

  return (
    <div className="min-h-full flex flex-col">
      <DailyProgress
        entries={entriesForDate}
        goal={settings.defaultGoal}
        calorieGoal={settings.calorieGoal}
        calorieTrackingEnabled={settings.calorieTrackingEnabled}
        mpsTrackingEnabled={settings.mpsTrackingEnabled}
        streak={streak}
        selectedDate={selectedDate}
        isToday={isSelectedToday}
        onPrevDay={handlePrevDay}
        onNextDay={canGoNext ? handleNextDay : undefined}
        onToday={!isSelectedToday ? handleToday : undefined}
      />
    </div>
  );
}
