import { useState, useEffect } from 'react';
import { Target, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GoalSetterProps {
  currentGoal: number;
  currentCalorieGoal?: number;
  calorieTrackingEnabled?: boolean;
  onSave: (goal: number, calorieGoal?: number) => void;
}

export function GoalSetter({ currentGoal, currentCalorieGoal, calorieTrackingEnabled, onSave }: GoalSetterProps) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(currentGoal.toString());
  const [calorieGoal, setCalorieGoal] = useState(currentCalorieGoal?.toString() || '');

  useEffect(() => {
    setGoal(currentGoal.toString());
    setCalorieGoal(currentCalorieGoal?.toString() || '');
  }, [currentGoal, currentCalorieGoal, open]);

  const handleSave = () => {
    const numGoal = parseInt(goal, 10);
    const numCalorieGoal = calorieGoal ? parseInt(calorieGoal, 10) : undefined;
    if (numGoal > 0 && numGoal <= 500) {
      onSave(numGoal, numCalorieGoal);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
          <Target className="h-3 w-3" />
          {currentGoal}g
          {calorieTrackingEnabled && currentCalorieGoal && (
            <span className="text-amber-600">· {currentCalorieGoal}</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Daily Goals</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Protein Goal */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-primary" />
              Protein
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                min={1}
                max={500}
                className="w-16 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">g</span>
            </div>
          </div>

          {/* Calorie Goal */}
          {calorieTrackingEnabled && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-amber-500" />
                Calories
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={calorieGoal}
                  onChange={(e) => setCalorieGoal(e.target.value)}
                  min={500}
                  max={10000}
                  className="w-16 h-8 text-sm"
                  placeholder="2000"
                />
                <span className="text-xs text-muted-foreground">kcal</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
