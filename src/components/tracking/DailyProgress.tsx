import { useMemo } from 'react';
import { Flame, Target, TrendingUp } from 'lucide-react';
import { ProgressRing } from './ProgressRing';
import { Card, CardContent } from '@/components/ui/card';
import type { FoodEntry, StreakInfo } from '@/types';

interface DailyProgressProps {
  entries: FoodEntry[];
  goal: number;
  streak: StreakInfo;
}

export function DailyProgress({ entries, goal, streak }: DailyProgressProps) {
  const totalProtein = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.protein, 0),
    [entries]
  );

  const remaining = Math.max(goal - totalProtein, 0);

  return (
    <div className="space-y-6 p-4">
      {/* Progress Ring */}
      <div className="flex justify-center py-4">
        <ProgressRing current={totalProtein} goal={goal} size={220} strokeWidth={14} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Target className="h-5 w-5 text-primary mb-1" />
            <span className="text-xl font-bold">{remaining}g</span>
            <span className="text-xs text-muted-foreground">Remaining</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <TrendingUp className="h-5 w-5 text-blue-500 mb-1" />
            <span className="text-xl font-bold">{entries.length}</span>
            <span className="text-xs text-muted-foreground">Entries</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Flame className="h-5 w-5 text-orange-500 mb-1" />
            <span className="text-xl font-bold">{streak.currentStreak}</span>
            <span className="text-xs text-muted-foreground">Day streak</span>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Today's Entries</h3>
          <div className="space-y-2">
            {entries.slice().reverse().map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {entry.protein}g
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{entry.foodName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {entry.source}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No entries yet today.</p>
          <p className="text-sm">Log your first meal to get started!</p>
        </div>
      )}
    </div>
  );
}
