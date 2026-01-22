import { useState } from 'react';
import { Target } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GoalSetterProps {
  currentGoal: number;
  onSave: (goal: number) => void;
}

export function GoalSetter({ currentGoal, onSave }: GoalSetterProps) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(currentGoal.toString());

  const handleSave = () => {
    const numGoal = parseInt(goal, 10);
    if (numGoal > 0 && numGoal <= 500) {
      onSave(numGoal);
      setOpen(false);
    }
  };

  const presets = [100, 120, 150, 180, 200];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Target className="h-4 w-4" />
          Goal: {currentGoal}g
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Daily Protein Goal</DialogTitle>
          <DialogDescription>
            Choose a daily protein target in grams.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset}
                variant={goal === preset.toString() ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGoal(preset.toString())}
              >
                {preset}g
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              min={1}
              max={500}
              className="w-24"
            />
            <span className="text-muted-foreground">grams per day</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Goal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
