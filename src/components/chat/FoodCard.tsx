import { Check, Edit2, CheckCircle, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FoodEntry } from '@/types';
import { format } from 'date-fns';

interface FoodCardProps {
  entry: Partial<FoodEntry>;
  onConfirm?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
  showCalories?: boolean;
  isConfirmed?: boolean;
}

export function FoodCard({
  entry,
  onConfirm,
  onEdit,
  onDelete,
  onCancel,
  showActions = true,
  showCalories = false,
  isConfirmed = false,
}: FoodCardProps) {
  const confidenceColor =
    entry.confidence === 'high'
      ? 'text-green-600 bg-green-50'
      : entry.confidence === 'medium'
      ? 'text-amber-600 bg-amber-50'
      : 'text-red-600 bg-red-50';

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground truncate">{entry.foodName}</h4>
          {entry.consumedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(entry.consumedAt, 'h:mm a')}
            </p>
          )}
        </div>
        {entry.confidence && (
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', confidenceColor)}>
            {entry.confidence}
          </span>
        )}
      </div>

      {/* Nutrition Stats */}
      <div className="flex items-baseline gap-4 mt-3">
        <div>
          <span className="text-3xl font-bold text-primary">{entry.protein}</span>
          <span className="text-sm text-muted-foreground ml-1">g protein</span>
        </div>
        {showCalories && entry.calories !== undefined && entry.calories > 0 && (
          <div>
            <span className="text-3xl font-bold text-amber-500">{entry.calories}</span>
            <span className="text-sm text-muted-foreground ml-1">kcal</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && !isConfirmed && (
        <div className="flex gap-2 mt-4">
          {onCancel && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 px-3 rounded-xl text-muted-foreground"
              onClick={onCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-10 rounded-xl"
            onClick={onEdit}
          >
            <Edit2 className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            className="flex-1 h-10 rounded-xl"
            onClick={onConfirm}
          >
            <Check className="h-4 w-4 mr-1.5" />
            Confirm
          </Button>
        </div>
      )}

      {/* Confirmed state - show edit/delete buttons */}
      {isConfirmed && showActions && (
        <div className="flex gap-2 mt-4">
          <div className="flex items-center gap-1.5 flex-1 text-green-600 text-sm">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Added</span>
          </div>
          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
