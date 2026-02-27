import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { format, subDays, addDays, isToday, startOfDay, parseISO } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Camera, Image as ImageIcon } from 'lucide-react';
import { DailyProgress } from '@/components/tracking/DailyProgress';
import { FoodEntryEditDialog } from '@/components/FoodEntryEditDialog';
import { useSettings, useStreak, useRecentEntries, useDeleteEntry } from '@/hooks/useProteinData';
import { useSleepForDate, useTrainingForDate } from '@/hooks/useTrackingData';
import { useStore } from '@/store/useStore';
import { updateFoodEntry } from '@/db';
import { triggerSync } from '@/store/useAuthStore';
import { refineAnalysis } from '@/services/ai/client';
import { compressImage, triggerHaptic, cn } from '@/lib/utils';
import type { FoodEntry, ConfidenceLevel } from '@/types';

const LONG_PRESS_DURATION = 400;

export function Dashboard() {
  const navigate = useNavigate();
  const { setPendingImageFromHome } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');

  // FAB state
  const [fabExpanded, setFabExpanded] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const menuJustOpenedRef = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFabTouchStart = useCallback(() => {
    isLongPressRef.current = false;
    menuJustOpenedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      menuJustOpenedRef.current = true;
      setFabExpanded(true);
      triggerHaptic('medium');
    }, LONG_PRESS_DURATION);
  }, []);

  const handleFabTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (menuJustOpenedRef.current) {
      menuJustOpenedRef.current = false;
      isLongPressRef.current = false;
      return;
    }
    if (fabExpanded) {
      setFabExpanded(false);
    } else if (!isLongPressRef.current) {
      navigate('/coach');
    }
    isLongPressRef.current = false;
  }, [fabExpanded, navigate]);

  const handleFabFileChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'camera' | 'gallery'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setPendingImageFromHome(compressed, source);
        navigate('/coach');
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }
    e.target.value = '';
    setFabExpanded(false);
  }, [navigate, setPendingImageFromHome]);

  useEffect(() => {
    if (!fabExpanded) return;
    const handler = () => setFabExpanded(false);
    const timer = setTimeout(() => document.addEventListener('touchstart', handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', handler);
    };
  }, [fabExpanded]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Initialize date from URL param or default to today
  const [selectedDate, setSelectedDate] = useState(() => {
    if (dateParam) {
      try {
        const parsed = parseISO(dateParam);
        if (!isNaN(parsed.getTime())) {
          return startOfDay(parsed);
        }
      } catch {
        // Invalid date, fall through to today
      }
    }
    return new Date();
  });

  // Clear URL param after initial load (don't keep it in the URL)
  useEffect(() => {
    if (dateParam) {
      setSearchParams({}, { replace: true });
    }
  }, [dateParam, setSearchParams]);
  const recentEntries = useRecentEntries(30);
  const { settings } = useSettings();
  const streak = useStreak(recentEntries, settings.defaultGoal);
  const deleteEntry = useDeleteEntry();
  const { setDashboardState } = useStore();

  // Filter entries for the selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const dateSleep = useSleepForDate(selectedDateStr);
  const dateTraining = useTrainingForDate(selectedDateStr);

  const dateSleepMinutes = dateSleep.reduce((sum, e) => sum + e.duration, 0);
  const dateTrainingSessions = dateTraining.length;

  // Edit dialog state
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
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

  const handleEditEntry = (entry: FoodEntry) => {
    setEditingEntry(entry);
  };

  const handleSaveEdit = useCallback(async (entryId: number, updates: Partial<FoodEntry>) => {
    await updateFoodEntry(entryId, updates);
    triggerSync();
  }, []);

  const handleRefineEdit = useCallback(async (
    originalAnalysis: {
      foodName: string;
      protein: number;
      calories: number;
      confidence: ConfidenceLevel;
      consumedAt?: { parsedDate: string; parsedTime: string };
    },
    refinement: string
  ) => {
    const hasApiAccess = settings.claudeApiKey || settings.hasAdminApiKey;
    const useProxy = !settings.claudeApiKey && settings.hasAdminApiKey;

    if (!hasApiAccess) return null;

    try {
      const result = await refineAnalysis(settings.claudeApiKey || null, originalAnalysis, refinement, useProxy);
      return {
        foodName: result.foodName,
        protein: result.protein,
        calories: result.calories,
      };
    } catch (error) {
      console.error('Refinement failed:', error);
      return null;
    }
  }, [settings.claudeApiKey, settings.hasAdminApiKey]);

  const handleDeleteEntry = useCallback((id: number) => {
    deleteEntry(id);
  }, [deleteEntry]);

  const canGoNext = !isToday(selectedDate);
  const isSelectedToday = isToday(selectedDate);
  const hasAIAccess = !!(settings.claudeApiKey || settings.hasAdminApiKey);

  // Update header state for "Today" button
  useEffect(() => {
    setDashboardState(!isSelectedToday, handleToday);
    return () => setDashboardState(false, null); // Cleanup when leaving Dashboard
  }, [isSelectedToday, setDashboardState]);

  return (
    <div className="min-h-full flex flex-col">
      <DailyProgress
        entries={entriesForDate}
        goal={settings.defaultGoal}
        calorieGoal={settings.calorieGoal}
        calorieTrackingEnabled={settings.calorieTrackingEnabled}
        mpsTrackingEnabled={settings.mpsTrackingEnabled}
        sleepTrackingEnabled={settings.sleepTrackingEnabled}
        trainingTrackingEnabled={settings.trainingTrackingEnabled}
        sleepGoalMinutes={settings.sleepGoalMinutes}
        dateSleepMinutes={dateSleepMinutes}
        dateTrainingSessions={dateTrainingSessions}
        streak={streak}
        selectedDate={selectedDate}
        isToday={isSelectedToday}
        onPrevDay={handlePrevDay}
        onNextDay={canGoNext ? handleNextDay : undefined}
        onToday={!isSelectedToday ? handleToday : undefined}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
      />

      <FoodEntryEditDialog
        entry={editingEntry}
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        onSave={handleSaveEdit}
        onRefine={handleRefineEdit}
        showCalories={settings.calorieTrackingEnabled}
        hasAIAccess={hasAIAccess}
      />

      {/* FAB - only on Today */}
      {isSelectedToday && (
        <>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => handleFabFileChange(e, 'camera')} className="hidden" />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={e => handleFabFileChange(e, 'gallery')} className="hidden" />

          {fabExpanded && (
            <>
              <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setFabExpanded(false)} />
              <div className="fixed bottom-44 right-6 z-50 flex flex-col gap-3 items-center">
                <button
                  className="h-12 w-12 rounded-full shadow-lg bg-secondary text-secondary-foreground flex items-center justify-center active:scale-95"
                  onClick={() => { galleryInputRef.current?.click(); triggerHaptic('light'); }}
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
                <button
                  className="h-12 w-12 rounded-full shadow-lg bg-secondary text-secondary-foreground flex items-center justify-center active:scale-95"
                  onClick={() => { cameraInputRef.current?.click(); triggerHaptic('light'); }}
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
            </>
          )}

          <button
            className={cn(
              'fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-all duration-200',
              fabExpanded ? 'rotate-45 bg-muted text-muted-foreground' : 'active:scale-95'
            )}
            onTouchStart={handleFabTouchStart}
            onTouchEnd={handleFabTouchEnd}
            onMouseDown={handleFabTouchStart}
            onMouseUp={handleFabTouchEnd}
          >
            <Plus className="h-7 w-7" />
          </button>
        </>
      )}
    </div>
  );
}
