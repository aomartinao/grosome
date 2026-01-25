import { useState, useRef, type ReactNode } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableRowProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function SwipeableRow({ children, onEdit, onDelete, className }: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const ACTION_WIDTH = onEdit && onDelete ? 120 : 60;
  const THRESHOLD = ACTION_WIDTH / 2;
  const DELETE_TRIGGER_THRESHOLD = ACTION_WIDTH + 60; // Extra 60px triggers delete

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = offsetX;
    isDraggingRef.current = true;
    setIsDeleting(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.touches[0].clientX - startXRef.current;
    let newOffset = currentXRef.current + deltaX;

    // Only allow swiping left (negative values)
    if (newOffset > 0) {
      newOffset = 0;
    }

    // Apply rubber band effect past the action width
    if (newOffset < -ACTION_WIDTH) {
      const overswipe = Math.abs(newOffset) - ACTION_WIDTH;
      const dampedOverswipe = Math.sqrt(overswipe) * 8; // Rubber band formula
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
    isDraggingRef.current = false;

    // If we reached delete threshold, trigger delete
    if (isDeleting && onDelete) {
      // Animate out then delete
      setOffsetX(-window.innerWidth);
      setTimeout(() => {
        onDelete();
      }, 200);
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

  const handleAction = (action: () => void) => {
    action();
    handleClose();
  };

  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      {/* Action buttons - only visible when revealed */}
      {isRevealed && (
        <div
          className="absolute inset-y-0 right-0 flex"
          style={{ opacity: Math.min(1, Math.abs(offsetX) / 60) }}
        >
          {onEdit && (
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
                "w-[60px] flex items-center justify-center text-white transition-colors",
                isDeleting ? "bg-red-600" : "bg-destructive active:bg-destructive/90"
              )}
              onClick={() => handleAction(onDelete)}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <div
        className={cn(
          "relative bg-muted/50",
          isDraggingRef.current ? "" : "transition-transform duration-200 ease-out"
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
          transitionDuration: isDraggingRef.current ? '0ms' : '200ms'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={isRevealed ? handleClose : undefined}
      >
        {children}
      </div>
    </div>
  );
}
