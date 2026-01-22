import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FoodEntry } from '@/types';

interface CalendarViewProps {
  entries: FoodEntry[];
  goals: Map<string, number>;
  defaultGoal: number;
}

export function CalendarView({ entries, goals, defaultGoal }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate protein totals for each day
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of entries) {
      const current = totals.get(entry.date) || 0;
      totals.set(entry.date, current + entry.protein);
    }
    return totals;
  }, [entries]);

  // Get the day of week for the first day (0 = Sunday)
  const startDay = getDay(monthStart);

  // Create padding for days before the first day of month
  const paddingDays = Array(startDay).fill(null);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs text-muted-foreground font-medium py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map((_, index) => (
          <div key={`padding-${index}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const protein = dailyTotals.get(dateStr) || 0;
          const goal = goals.get(dateStr) || defaultGoal;
          const goalMet = protein >= goal;
          const hasEntry = protein > 0;
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateStr}
              className={cn(
                'aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative',
                isToday && 'ring-2 ring-primary ring-offset-2',
                !isSameMonth(day, currentMonth) && 'opacity-50'
              )}
            >
              <span
                className={cn(
                  'font-medium',
                  goalMet && 'text-green-600',
                  !hasEntry && 'text-muted-foreground'
                )}
              >
                {format(day, 'd')}
              </span>
              {hasEntry && (
                <div
                  className={cn(
                    'absolute bottom-1 w-2 h-2 rounded-full',
                    goalMet ? 'bg-green-500' : 'bg-primary'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Has entry</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Goal met</span>
        </div>
      </div>
    </div>
  );
}
