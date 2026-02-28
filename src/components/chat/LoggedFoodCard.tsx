import { CheckCircle, BicepsFlexed, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { FoodEntry } from '@/types';

interface LoggedFoodCardProps {
  entry: Partial<FoodEntry>;
  showCalories?: boolean;
  isMPSHit?: boolean;
  className?: string;
}

export function LoggedFoodCard({
  entry,
  showCalories = false,
  isMPSHit = false,
  className,
}: LoggedFoodCardProps) {
  const isCancelled = !!entry.deletedAt;

  const confidenceColor =
    entry.confidence === 'high'
      ? 'text-green-600 bg-green-50'
      : entry.confidence === 'medium'
        ? 'text-amber-600 bg-amber-50'
        : 'text-red-600 bg-red-50';

  const timestamp = entry.consumedAt || entry.createdAt;

  return (
    <div className={cn(
      'relative rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-border/50 overflow-hidden min-h-[80px] flex flex-col justify-center transition-all duration-300',
      isCancelled ? 'opacity-50 grayscale bg-card' : (entry.imageData ? 'text-white' : 'bg-card text-card-foreground'),
      className
    )}>
      {/* Full Bleed Background Image */}
      {entry.imageData && !isCancelled && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 scale-105"
            style={{ backgroundImage: `url(${entry.imageData})` }}
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />
        </>
      )}

      {/* Content Layer */}
      <div className="relative z-10 flex items-center gap-3">
        {/* Protein badge (only show if no image) */}
        {!entry.imageData && (
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner",
            isCancelled ? "bg-muted" : "bg-primary/15"
          )}>
            <span className={cn(
              "text-lg font-bold tracking-tight",
              isCancelled ? "text-muted-foreground line-through" : "text-primary-700"
            )}>{entry.protein}g</span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium text-sm truncate",
              isCancelled && "line-through text-muted-foreground"
            )}>{entry.foodName}</span>
            {isMPSHit && !isCancelled && (
              <BicepsFlexed className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[11px] font-medium tracking-wide uppercase",
              entry.imageData && !isCancelled ? "text-white/80" : "text-muted-foreground"
            )}>
              {timestamp && format(timestamp, 'h:mm a')}
            </span>
            {isCancelled ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-red-600 bg-red-50/90 backdrop-blur-md">
                cancelled
              </span>
            ) : entry.confidence && (
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-md', confidenceColor, entry.imageData && "bg-opacity-90")}>
                {entry.confidence}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1">
            {isCancelled ? (
              <>
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="font-semibold text-muted-foreground line-through text-lg">{entry.protein}g</span>
              </>
            ) : (
              <>
                <CheckCircle className={cn("h-4 w-4", entry.imageData ? "text-green-300" : "text-green-500")} />
                <span className={cn("font-bold text-xl tracking-tighter", entry.imageData ? "text-white" : "text-primary-700")}>{entry.protein}g</span>
              </>
            )}
          </div>
          {showCalories && entry.calories !== undefined && entry.calories > 0 && !isCancelled && (
            <span className={cn("text-xs font-medium", entry.imageData ? "text-white/80" : "text-amber-600")}>{entry.calories} kcal</span>
          )}
        </div>
      </div>
    </div>
  );
}
