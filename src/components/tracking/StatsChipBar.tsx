import { Flame, Dumbbell, Moon, Weight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StreakInfo } from '@/types';

interface StatsChipBarProps {
  streak: StreakInfo;
  mpsHits?: number;
  mpsTrackingEnabled?: boolean;
  sleepMinutes?: number;
  sleepTrackingEnabled?: boolean;
  trainingSessions?: number;
  trainingTrackingEnabled?: boolean;
  isToday: boolean;
  onSleepClick?: () => void;
  onTrainingClick?: () => void;
}

export function StatsChipBar({
  streak,
  mpsHits = 0,
  mpsTrackingEnabled,
  sleepMinutes = 0,
  sleepTrackingEnabled,
  trainingSessions = 0,
  trainingTrackingEnabled,
  isToday,
  onSleepClick,
  onTrainingClick,
}: StatsChipBarProps) {
  const sleepLabel = sleepMinutes > 0
    ? `${Math.floor(sleepMinutes / 60)}h${sleepMinutes % 60 > 0 ? `${sleepMinutes % 60}m` : ''}`
    : '—';

  return (
    <div className="flex items-center justify-center gap-2 px-4 mt-3">
      {/* Streak chip - always visible */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10">
        <Flame className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-semibold text-orange-600">{streak.currentStreak}</span>
      </div>

      {/* MPS chip */}
      {mpsTrackingEnabled && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10">
          <Dumbbell className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold text-purple-600">{mpsHits}/3</span>
        </div>
      )}

      {/* Sleep chip */}
      {sleepTrackingEnabled && (
        <button
          onClick={isToday ? onSleepClick : undefined}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 transition-all',
            isToday && 'active:scale-95 cursor-pointer'
          )}
        >
          <Moon className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-blue-600">{sleepLabel}</span>
        </button>
      )}

      {/* Training chip */}
      {trainingTrackingEnabled && (
        <button
          onClick={isToday ? onTrainingClick : undefined}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 transition-all',
            isToday && 'active:scale-95 cursor-pointer'
          )}
        >
          <Weight className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-600">{trainingSessions}</span>
        </button>
      )}
    </div>
  );
}
