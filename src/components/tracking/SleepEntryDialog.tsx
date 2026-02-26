import { useState } from 'react';
import { Moon, Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addSleepEntry } from '@/db';
import { getToday, triggerHaptic } from '@/lib/utils';
import { triggerSync } from '@/store/useAuthStore';
import type { SleepQuality } from '@/types';

interface SleepEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sleepGoalMinutes?: number;
  onSaved?: () => void;
}

const PRESETS = [360, 420, 450, 480, 540]; // 6h, 7h, 7.5h, 8h, 9h
const QUALITIES: SleepQuality[] = ['poor', 'fair', 'good', 'great'];

const qualityConfig: Record<SleepQuality, { label: string; color: string; activeColor: string }> = {
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

export function SleepEntryDialog({
  open,
  onOpenChange,
  sleepGoalMinutes = 480,
  onSaved,
}: SleepEntryDialogProps) {
  const [duration, setDuration] = useState(480);
  const [quality, setQuality] = useState<SleepQuality | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const meetsGoal = duration >= sleepGoalMinutes;

  const adjustDuration = (delta: number) => {
    setDuration(prev => Math.max(0, Math.min(840, prev + delta)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await addSleepEntry({
        date: getToday(),
        duration,
        quality,
        source: 'manual',
        createdAt: new Date(),
      });
      triggerHaptic('light');
      triggerSync();
      onOpenChange(false);
      onSaved?.();
      // Reset for next use
      setDuration(480);
      setQuality(undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-blue-500" />
            Log Sleep
          </DialogTitle>
        </DialogHeader>

        {/* Duration presets */}
        <div className="flex gap-1.5">
          {PRESETS.map(preset => (
            <button
              key={preset}
              onClick={() => setDuration(preset)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                duration === preset
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {formatDuration(preset)}
            </button>
          ))}
        </div>

        {/* Fine-tune */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => adjustDuration(-30)}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-2xl font-bold text-blue-500 min-w-[80px] text-center">
            {formatDuration(duration)}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => adjustDuration(30)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Goal status */}
        <p className={cn('text-xs font-medium text-center', meetsGoal ? 'text-green-600' : 'text-amber-600')}>
          {meetsGoal ? `Goal met (${formatDuration(sleepGoalMinutes)})` : `Below goal (${formatDuration(sleepGoalMinutes)})`}
        </p>

        {/* Quality selector */}
        <div>
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
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
