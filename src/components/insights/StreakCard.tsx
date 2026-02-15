import { Flame, Trophy, Target } from 'lucide-react';

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  consistencyPercent: number;
}

export function StreakCard({ currentStreak, longestStreak, consistencyPercent }: StreakCardProps) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center gap-3">
        {/* Current streak */}
        <div className="flex items-center gap-2 flex-1">
          <div className="p-2 rounded-xl bg-orange-500/15">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">{currentStreak}</p>
            <p className="text-[10px] text-muted-foreground">day streak</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Best streak */}
        <div className="flex items-center gap-2 flex-1">
          <Trophy className="h-4 w-4 text-amber-500" />
          <div>
            <p className="text-sm font-semibold leading-tight">{longestStreak}</p>
            <p className="text-[10px] text-muted-foreground">best</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Consistency */}
        <div className="flex items-center gap-2 flex-1">
          <Target className="h-4 w-4 text-emerald-500" />
          <div>
            <p className="text-sm font-semibold leading-tight">{Math.round(consistencyPercent)}%</p>
            <p className="text-[10px] text-muted-foreground">consistency</p>
          </div>
        </div>
      </div>
    </div>
  );
}
