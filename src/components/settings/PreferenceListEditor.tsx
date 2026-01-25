import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PreferenceListEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  items: string[];
  onSave: (items: string[]) => void;
  presets?: string[];
}

export function PreferenceListEditor({
  open,
  onOpenChange,
  title,
  description,
  items,
  onSave,
  presets = [],
}: PreferenceListEditorProps) {
  const [editedItems, setEditedItems] = useState<string[]>(items);
  const [newItem, setNewItem] = useState('');

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setEditedItems(items);
      setNewItem('');
    }
    onOpenChange(isOpen);
  };

  const addItem = (item: string) => {
    const trimmed = item.trim().toLowerCase();
    if (trimmed && !editedItems.includes(trimmed)) {
      setEditedItems([...editedItems, trimmed]);
    }
    setNewItem('');
  };

  const removeItem = (item: string) => {
    setEditedItems(editedItems.filter((i) => i !== item));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(newItem);
    }
  };

  const handleSave = () => {
    onSave(editedItems);
    onOpenChange(false);
  };

  // Filter presets to only show ones not already added
  const availablePresets = presets.filter(
    (p) => !editedItems.includes(p.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current items */}
          {editedItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {editedItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                >
                  {item}
                  <button
                    onClick={() => removeItem(item)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add new item input */}
          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type and press Enter..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => addItem(newItem)}
              disabled={!newItem.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Preset suggestions */}
          {availablePresets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {availablePresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => addItem(preset)}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm border',
                      'bg-muted/50 hover:bg-muted text-foreground',
                      'transition-colors'
                    )}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
