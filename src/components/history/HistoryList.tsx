import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { FoodEntry, DailyStats } from '@/types';

interface HistoryListProps {
  entries: FoodEntry[];
  goals: Map<string, number>;
  defaultGoal: number;
  calorieTrackingEnabled?: boolean;
  onDelete: (id: number) => void;
  onEdit?: (entry: FoodEntry) => void;
}

export function HistoryList({ entries, goals, defaultGoal, calorieTrackingEnabled, onDelete, onEdit }: HistoryListProps) {
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  const handleEditClick = (entry: FoodEntry) => {
    setEditingEntry(entry);
    setEditName(entry.foodName);
    setEditProtein(entry.protein.toString());
    setEditCalories(entry.calories?.toString() || '');
    setEditDate(entry.date);
    // Use consumedAt time if available, otherwise use createdAt time
    const timeSource = entry.consumedAt || entry.createdAt;
    setEditTime(format(timeSource, 'HH:mm'));
  };

  const handleSaveEdit = () => {
    if (!editingEntry || !onEdit) return;

    // Construct consumedAt from date/time inputs
    let consumedAt: Date | undefined;
    if (editDate && editTime) {
      const [year, month, day] = editDate.split('-').map(Number);
      const [hours, minutes] = editTime.split(':').map(Number);
      consumedAt = new Date(year, month - 1, day, hours, minutes);
    }

    const updatedEntry: FoodEntry = {
      ...editingEntry,
      foodName: editName,
      protein: parseInt(editProtein, 10) || 0,
      calories: editCalories ? parseInt(editCalories, 10) : undefined,
      date: editDate || editingEntry.date,
      consumedAt,
    };

    onEdit(updatedEntry);
    setEditingEntry(null);
  };

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, DailyStats>();

    // Sort entries by date descending
    const sorted = [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const entry of sorted) {
      if (!groups.has(entry.date)) {
        const goal = goals.get(entry.date) || defaultGoal;
        groups.set(entry.date, {
          date: entry.date,
          totalProtein: 0,
          totalCalories: 0,
          goal,
          entries: [],
          goalMet: false,
        });
      }

      const stats = groups.get(entry.date)!;
      stats.entries.push(entry);
      stats.totalProtein += entry.protein;
      stats.totalCalories += entry.calories || 0;
      stats.goalMet = stats.totalProtein >= stats.goal;
    }

    // Sort entries within each day by createdAt descending (newest first)
    const result = Array.from(groups.values());
    for (const day of result) {
      day.entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [entries, goals, defaultGoal]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No entries yet.</p>
        <p className="text-sm">Start logging your protein intake!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {groupedByDate.map((day) => (
          <div key={day.date} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">
                  {format(parseISO(day.date), 'EEEE, MMM d')}
                </h3>
                {day.goalMet && (
                  <Badge variant="success" className="text-xs">
                    Goal met
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {day.totalProtein}g / {day.goal}g
                {calorieTrackingEnabled && day.totalCalories > 0 && (
                  <span className="ml-2 text-amber-600">· {day.totalCalories} kcal</span>
                )}
              </span>
            </div>

            <div className="space-y-2">
              {day.entries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {entry.imageData && (
                        <img
                          src={entry.imageData}
                          alt={entry.foodName}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium text-sm">{entry.foodName}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize">
                            {entry.source}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(entry.consumedAt || entry.createdAt, 'h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-bold text-primary">{entry.protein}g</span>
                        {calorieTrackingEnabled && entry.calories && (
                          <span className="text-xs text-amber-600 ml-1">· {entry.calories} kcal</span>
                        )}
                      </div>
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleEditClick(entry)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => entry.id && onDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Food Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Protein (grams)</label>
              <Input
                type="number"
                value={editProtein}
                onChange={(e) => setEditProtein(e.target.value)}
                min={0}
                max={500}
              />
            </div>
            {calorieTrackingEnabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Calories (kcal)</label>
                <Input
                  type="number"
                  value={editCalories}
                  onChange={(e) => setEditCalories(e.target.value)}
                  min={0}
                  max={10000}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
