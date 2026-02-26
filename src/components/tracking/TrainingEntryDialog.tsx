import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addTrainingEntry } from '@/db';
import { getToday, triggerHaptic } from '@/lib/utils';
import { triggerSync } from '@/store/useAuthStore';
import type { MuscleGroup } from '@/types';

interface TrainingEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const muscleGroups: { value: MuscleGroup; label: string; color: string; activeColor: string }[] = [
  { value: 'push', label: 'Push', color: 'text-muted-foreground border-border', activeColor: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'pull', label: 'Pull', color: 'text-muted-foreground border-border', activeColor: 'text-purple-600 bg-purple-50 border-purple-200' },
  { value: 'legs', label: 'Legs', color: 'text-muted-foreground border-border', activeColor: 'text-orange-600 bg-orange-50 border-orange-200' },
  { value: 'full_body', label: 'Full Body', color: 'text-muted-foreground border-border', activeColor: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'cardio', label: 'Cardio', color: 'text-muted-foreground border-border', activeColor: 'text-red-600 bg-red-50 border-red-200' },
];

const DURATION_PRESETS = [30, 45, 60, 90];

export function TrainingEntryDialog({
  open,
  onOpenChange,
  onSaved,
}: TrainingEntryDialogProps) {
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('full_body');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await addTrainingEntry({
        date: getToday(),
        muscleGroup,
        duration,
        notes: notes.trim() || undefined,
        source: 'manual',
        createdAt: new Date(),
      });
      triggerHaptic('light');
      triggerSync();
      onOpenChange(false);
      onSaved?.();
      // Reset for next use
      setMuscleGroup('full_body');
      setDuration(60);
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-500" />
            Log Training
          </DialogTitle>
        </DialogHeader>

        {/* Muscle group selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Muscle Group</p>
          <div className="flex flex-wrap gap-1.5">
            {muscleGroups.map(g => (
              <button
                key={g.value}
                onClick={() => setMuscleGroup(g.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  muscleGroup === g.value ? g.activeColor : g.color
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration presets */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Duration</p>
          <div className="flex gap-1.5">
            {DURATION_PRESETS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  duration === d
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {d}min
              </button>
            ))}
          </div>
        </div>

        {/* Notes (optional) */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Notes (optional)</p>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Heavy squats, PR on bench..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
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
