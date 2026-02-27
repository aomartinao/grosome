import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { BicepsFlexed, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProgressRing } from './ProgressRing';
import { StatsChipBar } from './StatsChipBar';
import { SleepEntryDialog } from './SleepEntryDialog';
import { TrainingEntryDialog } from './TrainingEntryDialog';
import { Button } from '@/components/ui/button';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { calculateMPSHits, cn, formatTime } from '@/lib/utils';
import type { FoodEntry, StreakInfo } from '@/types';

interface DailyProgressProps {
  entries: FoodEntry[];
  goal: number;
  calorieGoal?: number;
  calorieTrackingEnabled?: boolean;
  mpsTrackingEnabled?: boolean;
  sleepTrackingEnabled?: boolean;
  trainingTrackingEnabled?: boolean;
  sleepGoalMinutes?: number;
  dateSleepMinutes?: number;
  dateTrainingSessions?: number;
  streak: StreakInfo;
  selectedDate: Date;
  isToday: boolean;
  onPrevDay: () => void;
  onNextDay?: () => void;
  onToday?: () => void;
  onEditEntry?: (entry: FoodEntry) => void;
  onDeleteEntry?: (id: number) => void;
}

export function DailyProgress({
  entries,
  goal,
  calorieGoal,
  calorieTrackingEnabled,
  mpsTrackingEnabled,
  sleepTrackingEnabled,
  trainingTrackingEnabled,
  sleepGoalMinutes = 480,
  dateSleepMinutes = 0,
  dateTrainingSessions = 0,
  streak,
  selectedDate,
  isToday,
  onPrevDay,
  onNextDay,
  onEditEntry,
  onDeleteEntry,
}: DailyProgressProps) {
  const navigate = useNavigate();

  // Dialog state
  const [sleepDialogOpen, setSleepDialogOpen] = useState(false);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);

  // Swipe state for date navigation
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [isSwiping, setIsSwiping] = useState(false);

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

  // Create a Set of MPS hit entry IDs for quick lookup
  const mpsHitIds = useMemo(() => {
    return new Set(mpsHits.map(hit => hit.id).filter(Boolean));
  }, [mpsHits]);

  const effectiveCalorieGoal = calorieGoal || 2000; // Default to 2000 kcal
  const showDualRings = calorieTrackingEnabled;

  // Swipe handlers for date navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - swipeStartX.current;
    const deltaY = e.touches[0].clientY - swipeStartY.current;

    // Only consider horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      setIsSwiping(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping) return;

    const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
    const SWIPE_THRESHOLD = 50;

    if (deltaX > SWIPE_THRESHOLD) {
      onPrevDay();
    } else if (deltaX < -SWIPE_THRESHOLD && onNextDay) {
      onNextDay();
    }

    setIsSwiping(false);
  };

  return (
    <div className="flex flex-col min-h-full relative">
      {/* Date Label */}
      <div className="flex items-center justify-center px-4 py-2">
        <div className="text-center">
          <span className="font-semibold">
            {isToday ? 'Today' : `${format(selectedDate, 'EEEE')}, ${format(selectedDate, 'MMM d')}`}
          </span>
        </div>
      </div>

      {/* Hero Section - Progress Ring(s) with Navigation Arrows */}
      <div
        className="flex-1 flex flex-col justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Rings with arrows - centered together */}
        <div className="flex items-center justify-center gap-1">
          {/* Left Arrow */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onPrevDay();
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          {/* Progress Rings */}
          <div>
            {showDualRings ? (
              <div className="flex gap-4 items-center">
                <ProgressRing
                  current={totalProtein}
                  goal={goal}
                  size={140}
                  strokeWidth={10}
                  variant="protein"
                  label="Protein"
                  unit="g"
                />
                <ProgressRing
                  current={totalCalories}
                  goal={effectiveCalorieGoal}
                  size={140}
                  strokeWidth={10}
                  variant="calories"
                  label="Calories"
                  unit=""
                />
              </div>
            ) : (
              <ProgressRing current={totalProtein} goal={goal} size={200} strokeWidth={12} label="Protein" />
            )}
          </div>

          {/* Right Arrow */}
          <div
            className={cn('h-10 w-10 flex-shrink-0', !onNextDay && 'opacity-30')}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => onNextDay?.()}
              disabled={!onNextDay}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </div>

      </div>

      {/* Stats Chip Bar */}
      <StatsChipBar
        streak={streak}
        mpsHits={mpsHits.length}
        mpsTrackingEnabled={mpsTrackingEnabled}
        sleepMinutes={dateSleepMinutes}
        sleepTrackingEnabled={sleepTrackingEnabled}
        trainingSessions={dateTrainingSessions}
        trainingTrackingEnabled={trainingTrackingEnabled}
        isToday={isToday}
        onSleepClick={() => setSleepDialogOpen(true)}
        onTrainingClick={() => setTrainingDialogOpen(true)}
      />

      {/* Entry Dialogs */}
      <SleepEntryDialog
        open={sleepDialogOpen}
        onOpenChange={setSleepDialogOpen}
        sleepGoalMinutes={sleepGoalMinutes}
      />
      <TrainingEntryDialog
        open={trainingDialogOpen}
        onOpenChange={setTrainingDialogOpen}
      />

      {/* Bottom Section - Entries */}
      <div className="mt-6 bg-card rounded-t-3xl shadow-lg flex flex-col min-h-[40vh]">
        {/* Entries Section - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {entries.length > 0 && (
            <div className="space-y-1.5">
              {[...entries].sort((a, b) => {
                const timeA = (a.consumedAt || a.createdAt).getTime();
                const timeB = (b.consumedAt || b.createdAt).getTime();
                return timeB - timeA; // Most recent first
              }).map((entry) => (
                <SwipeableRow
                  key={entry.id}
                  itemName={entry.foodName}
                  onEdit={isToday && onEditEntry ? () => onEditEntry(entry) : undefined}
                  onDelete={isToday && onDeleteEntry && entry.id ? () => onDeleteEntry(entry.id!) : undefined}
                >
                  <div className="flex items-center gap-3 p-2.5">
                    {entry.imageData ? (
                      <img
                        src={entry.imageData}
                        alt={entry.foodName}
                        loading="lazy"
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{entry.protein}g</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.foodName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(entry.consumedAt || entry.createdAt)}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-1.5">
                      {mpsTrackingEnabled && entry.id && mpsHitIds.has(entry.id) && (
                        <BicepsFlexed className="h-3.5 w-3.5 text-purple-500" />
                      )}
                      <div>
                        <span className="text-sm font-semibold text-primary">{entry.protein}g</span>
                        {calorieTrackingEnabled && entry.calories ? (
                          <p className="text-xs text-amber-600">{entry.calories} kcal</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              ))}
            </div>
          )}

          {/* Add meal prompt - always visible on Today, "No entries" on past days */}
          {isToday ? (
            <div
              className="flex flex-col items-center justify-center py-8 text-center cursor-pointer hover:bg-muted/30 rounded-xl transition-colors"
              onClick={() => navigate('/coach')}
            >
              <p className="text-muted-foreground">
                {entries.length > 0 ? 'Tap to add another meal' : 'Tap here to log your first meal'}
              </p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">No entries this day</p>
            </div>
          ) : null}
        </div>

        {/* View History Link */}
        <button
          className="flex items-center justify-center gap-2 py-4 border-t border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigate('/insights')}
        >
          <History className="h-4 w-4" />
          View full history
        </button>
      </div>
    </div>
  );
}
