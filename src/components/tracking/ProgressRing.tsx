import { cn } from '@/lib/utils';

interface ProgressRingProps {
  current: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({
  current,
  goal,
  size = 200,
  strokeWidth = 12,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((current / goal) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;
  const isGoalMet = current >= goal;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-500 ease-out',
            isGoalMet ? 'text-green-500' : 'text-primary'
          )}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={cn(
          'text-4xl font-bold',
          isGoalMet ? 'text-green-500' : 'text-foreground'
        )}>
          {Math.round(current)}
        </span>
        <span className="text-sm text-muted-foreground">
          / {goal}g
        </span>
        {isGoalMet && (
          <span className="text-xs text-green-500 font-medium mt-1">
            Goal met!
          </span>
        )}
      </div>
    </div>
  );
}
