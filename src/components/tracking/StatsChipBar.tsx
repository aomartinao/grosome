import { Flame, BicepsFlexed, Moon, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
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

      {/* MPS chip with info popover */}
      {mpsTrackingEnabled && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 transition-all active:scale-95">
              <BicepsFlexed className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold text-purple-600">{mpsHits}/3</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Muscle Protein Synthesis (MPS)</h4>
              <p className="text-sm text-muted-foreground">
                MPS is the process by which your body repairs and builds muscle in response to
                strength training and protein intake. Aim for ~20–40g of high-quality protein per meal,
                spaced every 3–5 hours, for 3–4 intakes per day.
              </p>
              <a
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Source: ISSN Position Stand →
              </a>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <strong>How it's calculated:</strong> Each meal with ≥25g of protein counts as an MPS hit,
                  but only if it's been 3+ hours since your last hit. Aim for 3 hits per day.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
          <Dumbbell className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-600">{trainingSessions}</span>
        </button>
      )}
    </div>
  );
}
