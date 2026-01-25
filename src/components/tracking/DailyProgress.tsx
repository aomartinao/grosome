import { useMemo } from 'react';
import { Flame, Target, TrendingUp, Zap, Dumbbell } from 'lucide-react';
import { ProgressRing } from './ProgressRing';
import { Card, CardContent } from '@/components/ui/card';
import { calculateMPSHits } from '@/lib/utils';
import type { FoodEntry, StreakInfo } from '@/types';

interface DailyProgressProps {
  entries: FoodEntry[];
  goal: number;
  calorieGoal?: number;
  calorieTrackingEnabled?: boolean;
  mpsTrackingEnabled?: boolean;
  streak: StreakInfo;
}

export function DailyProgress({ entries, goal, calorieGoal, calorieTrackingEnabled, mpsTrackingEnabled, streak }: DailyProgressProps) {
  const totalProtein = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.protein, 0),
    [entries]
  );

  const totalCalories = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.calories || 0), 0),
    [entries]
  );

  const mpsHits = useMemo(
    () => mpsTrackingEnabled ? calculateMPSHits(entries) : [],
    [entries, mpsTrackingEnabled]
  );

  const remaining = Math.max(goal - totalProtein, 0);
  const caloriesRemaining = calorieGoal ? Math.max(calorieGoal - totalCalories, 0) : 0;

  const showDualRings = calorieTrackingEnabled && calorieGoal;

  return (
    <div className="space-y-6 p-4">
      {/* Progress Ring(s) */}
      <div className="flex justify-center py-4">
        {showDualRings ? (
          <div className="flex gap-4 items-center">
            <ProgressRing
              current={totalProtein}
              goal={goal}
              size={150}
              strokeWidth={12}
              variant="protein"
              label="Protein"
              unit="g"
            />
            <ProgressRing
              current={totalCalories}
              goal={calorieGoal}
              size={150}
              strokeWidth={12}
              variant="calories"
              label="Calories"
              unit=""
            />
          </div>
        ) : (
          <ProgressRing current={totalProtein} goal={goal} size={220} strokeWidth={14} />
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Target className="h-5 w-5 text-primary mb-1" />
            <span className="text-2xl font-bold">{remaining}g</span>
            <span className="text-xs text-muted-foreground">Protein left</span>
          </CardContent>
        </Card>

        {calorieTrackingEnabled && calorieGoal ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-4">
              <Zap className="h-5 w-5 text-amber-500 mb-1" />
              <span className="text-2xl font-bold">{caloriesRemaining}</span>
              <span className="text-xs text-muted-foreground">kcal left</span>
            </CardContent>
          </Card>
        ) : mpsTrackingEnabled ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-4">
              <Dumbbell className="h-5 w-5 text-purple-500 mb-1" />
              <span className="text-2xl font-bold">{mpsHits.length}<span className="text-base font-normal text-muted-foreground">/3</span></span>
              <span className="text-xs text-muted-foreground">MPS hits</span>
            </CardContent>
          </Card>
        ) : (
          <Card variant="dark">
            <CardContent className="flex flex-col items-center justify-center p-4">
              <TrendingUp className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl font-bold">{entries.length}</span>
              <span className="text-xs text-white/60">Entries</span>
            </CardContent>
          </Card>
        )}

        {calorieTrackingEnabled && calorieGoal && mpsTrackingEnabled ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-4">
              <Dumbbell className="h-5 w-5 text-purple-500 mb-1" />
              <span className="text-2xl font-bold">{mpsHits.length}<span className="text-base font-normal text-muted-foreground">/3</span></span>
              <span className="text-xs text-muted-foreground">MPS hits</span>
            </CardContent>
          </Card>
        ) : calorieTrackingEnabled && calorieGoal ? (
          <Card variant="dark">
            <CardContent className="flex flex-col items-center justify-center p-4">
              <TrendingUp className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl font-bold">{entries.length}</span>
              <span className="text-xs text-white/60">Entries</span>
            </CardContent>
          </Card>
        ) : null}

        <Card variant="dark">
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Flame className="h-5 w-5 text-orange-500 mb-1" />
            <span className="text-2xl font-bold">{streak.currentStreak}</span>
            <span className="text-xs text-white/60">Day streak</span>
          </CardContent>
        </Card>

        {!(calorieTrackingEnabled && calorieGoal) && !mpsTrackingEnabled && (
          <Card variant="dark">
            <CardContent className="flex flex-col items-center justify-center p-4">
              <TrendingUp className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl font-bold">{entries.length}</span>
              <span className="text-xs text-white/60">Entries</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Entries */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Today's Entries</h3>
          <div className="space-y-2">
            {entries.slice().reverse().map((entry) => (
              <Card key={entry.id} variant="dark">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-foreground">
                        {entry.protein}g
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-white">{entry.foodName}</p>
                      <p className="text-xs text-white/50">
                        <span className="capitalize">{entry.source}</span>
                        {calorieTrackingEnabled && entry.calories ? (
                          <span> · {entry.calories} kcal</span>
                        ) : null}
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
