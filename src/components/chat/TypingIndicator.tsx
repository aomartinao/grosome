import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  className?: string;
  isAnalyzing?: boolean;
}

export function TypingIndicator({ className, isAnalyzing }: TypingIndicatorProps) {
  if (isAnalyzing) {
    return (
      <div className={cn('flex items-center gap-3 py-1', className)}>
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </div>
        <span className="text-sm font-medium text-amber-600/80 tracking-wide shimmer-on-complete">Analyzing image...</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 py-2', className)}>
      <span
        className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
        style={{ animationDelay: '0ms', animationDuration: '600ms' }}
      />
      <span
        className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
        style={{ animationDelay: '150ms', animationDuration: '600ms' }}
      />
      <span
        className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
        style={{ animationDelay: '300ms', animationDuration: '600ms' }}
      />
    </div>
  );
}
