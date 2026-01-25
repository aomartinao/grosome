import { useState, useRef, type ReactNode } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SwipeableRowProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  itemName?: string;
}

export function SwipeableRow({ children, onEdit, onDelete, className, itemName }: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const hasMoved = useRef(false);

  const ACTION_WIDTH = onEdit && onDelete ? 120 : 60;
  const THRESHOLD = ACTION_WIDTH / 2;
  const DELETE_TRIGGER_THRESHOLD = ACTION_WIDTH + 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = offsetX;
    setIsDragging(true);
    hasMoved.current = false;
    setIsDeleting(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaX = e.touches[0].clientX - startXRef.current;

    if (Math.abs(deltaX) > 5) {
      hasMoved.current = true;
    }

    let newOffset = currentXRef.current + deltaX;

    // Only allow swiping left (negative values)
    if (newOffset > 0) {
      newOffset = 0;
    }

    // Apply rubber band effect past the action width
    if (newOffset < -ACTION_WIDTH) {
      const overswipe = Math.abs(newOffset) - ACTION_WIDTH;
      const dampedOverswipe = Math.sqrt(overswipe) * 8;
      newOffset = -(ACTION_WIDTH + dampedOverswipe);

      // Check if we've reached delete trigger threshold
      if (Math.abs(newOffset) > DELETE_TRIGGER_THRESHOLD) {
        setIsDeleting(true);
      } else {
        setIsDeleting(false);
      }
    }

    setOffsetX(newOffset);

    // Show actions when swiping
    if (newOffset < -10) {
      setIsRevealed(true);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // If we reached delete threshold, show confirmation
    if (isDeleting && onDelete) {
      setShowDeleteDialog(true);
      // Reset position
      setOffsetX(-ACTION_WIDTH);
      setIsDeleting(false);
      return;
    }

    // Snap to open or closed
    if (offsetX < -THRESHOLD) {
      setOffsetX(-ACTION_WIDTH);
      setIsRevealed(true);
    } else {
      setOffsetX(0);
      setIsRevealed(false);
    }
  };

  const handleClose = () => {
    setOffsetX(0);
    setIsRevealed(false);
  };

  const handleClick = () => {
    // Desktop click toggle - only if we didn't drag
    if (!hasMoved.current && (onEdit || onDelete)) {
      if (isRevealed) {
        handleClose();
      } else {
        setOffsetX(-ACTION_WIDTH);
        setIsRevealed(true);
      }
    }
  };

  const handleAction = (action: () => void) => {
    action();
    handleClose();
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false);
    if (onDelete) {
      // Animate out then delete
      setOffsetX(-window.innerWidth);
      setTimeout(() => {
        onDelete();
      }, 200);
    }
  };

  // Calculate the width of the delete button when in delete territory
  const deleteButtonWidth = isDeleting
    ? Math.abs(offsetX) - (onEdit ? 60 : 0)
    : 60;

  return (
    <>
      <div className={cn('relative overflow-hidden rounded-xl', className)}>
        {/* Action buttons - only visible when revealed */}
        {isRevealed && (
          <div
            className="absolute inset-y-0 right-0 flex"
            style={{ opacity: Math.min(1, Math.abs(offsetX) / 60) }}
          >
            {onEdit && !isDeleting && (
              <button
                className="w-[60px] flex items-center justify-center bg-blue-500 text-white active:bg-blue-600"
                onClick={() => handleAction(onEdit)}
              >
                <Edit2 className="h-5 w-5" />
              </button>
            )}
            {onDelete && (
              <button
                className={cn(
                  "flex items-center justify-center text-white transition-all",
                  isDeleting ? "bg-red-600" : "bg-destructive active:bg-destructive/90"
                )}
                style={{ width: `${deleteButtonWidth}px` }}
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-5 w-5" />
                {isDeleting && <span className="ml-2 text-sm font-medium">Delete</span>}
              </button>
            )}
          </div>
        )}

        {/* Main content */}
        <div
          className="relative bg-muted/50 cursor-pointer"
          style={{
            transform: `translateX(${offsetX}px)`,
            transition: isDragging ? 'none' : 'transform 200ms ease-out'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          {children}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
            <DialogDescription>
              {itemName
                ? `Are you sure you want to delete "${itemName}"?`
                : 'Are you sure you want to delete this entry?'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
