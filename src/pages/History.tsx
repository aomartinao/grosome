import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HistoryList } from '@/components/history/HistoryList';
import { WeeklyChart } from '@/components/history/WeeklyChart';
import { CalendarView } from '@/components/history/CalendarView';
import { useRecentEntries, useDeleteEntry, useDailyGoals, useSettings } from '@/hooks/useProteinData';
import { updateFoodEntry } from '@/db';
import { triggerSync } from '@/store/useAuthStore';
import type { FoodEntry } from '@/types';

export function History() {
  const [activeTab, setActiveTab] = useState('list');
  const entries = useRecentEntries(90);
  const deleteEntry = useDeleteEntry();
  const dailyGoals = useDailyGoals();
  const { settings } = useSettings();

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

    // Trigger sync (entries auto-refresh via useLiveQuery)
    triggerSync();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="chart">Week</TabsTrigger>
          <TabsTrigger value="calendar">Month</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <HistoryList
            entries={entries}
            goals={dailyGoals}
            defaultGoal={settings.defaultGoal}
            calorieTrackingEnabled={settings.calorieTrackingEnabled}
            onDelete={deleteEntry}
            onEdit={handleEdit}
          />
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <WeeklyChart entries={entries} goal={settings.defaultGoal} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView
            entries={entries}
            goals={dailyGoals}
            defaultGoal={settings.defaultGoal}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
