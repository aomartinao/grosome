import { useState } from 'react';
import { Check, X, Moon, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SleepQuickLogCardProps {
  onConfirm: (data: { duration: number; quality?: string }) => void;
  onCancel: () => void;
  sleepGoalMinutes?: number;
}

const PRESETS = [360, 420, 450, 480, 540]; // 6h, 7h, 7.5h, 8h, 9h
const QUALITIES = ['poor', 'fair', 'good', 'great'] as const;

const qualityConfig: Record<string, { label: string; color: string; activeColor: string }> = {
  poor: { label: 'Poor', color: 'text-muted-foreground border-border', activeColor: 'text-red-600 bg-red-50 border-red-200' },
  fair: { label: 'Fair', color: 'text-muted-foreground border-border', activeColor: 'text-amber-600 bg-amber-50 border-amber-200' },
  good: { label: 'Good', color: 'text-muted-foreground border-border', activeColor: 'text-blue-600 bg-blue-50 border-blue-200' },
  great: { label: 'Great', color: 'text-muted-foreground border-border', activeColor: 'text-green-600 bg-green-50 border-green-200' },
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function SleepQuickLogCard({
  onConfirm,
  onCancel,
  sleepGoalMinutes,
}: SleepQuickLogCardProps) {
  const [duration, setDuration] = useState(480); // Default 8h
  const [quality, setQuality] = useState<string | undefined>(undefined);

  const meetsGoal = sleepGoalMinutes ? duration >= sleepGoalMinutes : null;

  const adjustDuration = (delta: number) => {
    setDuration(prev => Math.max(0, Math.min(840, prev + delta))); // 0-14h
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Moon className="h-5 w-5 text-indigo-500" />
        <h4 className="font-semibold text-foreground">Log Sleep</h4>
      </div>

      {/* Duration presets */}
      <div className="flex gap-1.5 mb-3">
        {PRESETS.map(preset => (
          <button
            key={preset}
            onClick={() => setDuration(preset)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
              duration === preset
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {formatDuration(preset)}
          </button>
        ))}
      </div>

      {/* Fine-tune */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => adjustDuration(-30)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-2xl font-bold text-indigo-500 min-w-[80px] text-center">
          {formatDuration(duration)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => adjustDuration(30)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Goal status */}
      {meetsGoal !== null && (
        <p className={cn('text-xs font-medium text-center mb-3', meetsGoal ? 'text-green-600' : 'text-amber-600')}>
          {meetsGoal
            ? `Goal met (${formatDuration(sleepGoalMinutes!)})`
            : `Below goal (${formatDuration(sleepGoalMinutes!)})`}
        </p>
      )}

      {/* Quality selector */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Quality (optional)</p>
        <div className="flex gap-1.5">
          {QUALITIES.map(q => {
            const config = qualityConfig[q];
            const isActive = quality === q;
            return (
              <button
                key={q}
                onClick={() => setQuality(isActive ? undefined : q)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  isActive ? config.activeColor : config.color
                )}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 px-3 rounded-xl text-muted-foreground"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1 h-10 rounded-xl"
          onClick={() => onConfirm({ duration, quality })}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Confirm
        </Button>
      </div>
    </div>
  );
}
