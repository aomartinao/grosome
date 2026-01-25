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
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const ACTION_WIDTH = onEdit && onDelete ? 120 : 60;
  const THRESHOLD = ACTION_WIDTH / 2;

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = offsetX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.touches[0].clientX - startXRef.current;
    let newOffset = currentXRef.current + deltaX;

    // Clamp the offset
    newOffset = Math.max(-ACTION_WIDTH, Math.min(0, newOffset));
    setOffsetX(newOffset);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;

    if (offsetX < -THRESHOLD) {
      setOffsetX(-ACTION_WIDTH);
      setIsOpen(true);
    } else {
      setOffsetX(0);
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setOffsetX(0);
    setIsOpen(false);
  };

  const handleAction = (action: () => void) => {
    action();
    handleClose();
  };

  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      {/* Action buttons behind */}
      <div className="absolute inset-y-0 right-0 flex">
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
            className="w-[60px] flex items-center justify-center bg-destructive text-destructive-foreground active:bg-destructive/90"
            onClick={() => handleAction(onDelete)}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main content */}
      <div
        className="relative bg-muted/50 transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={isOpen ? handleClose : undefined}
      >
        {children}
      </div>
    </div>
  );
}
