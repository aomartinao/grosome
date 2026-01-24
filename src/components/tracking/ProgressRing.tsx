import { cn } from '@/lib/utils';

interface ProgressRingProps {
  current: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  variant?: 'protein' | 'calories';
  label?: string;
  unit?: string;
  showCenter?: boolean;
}

export function ProgressRing({
  current,
  goal,
  size = 200,
  strokeWidth = 12,
  className,
  variant = 'protein',
  label,
  unit = 'g',
  showCenter = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((current / goal) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;
  const isGoalMet = current >= goal;

  const gradientId = `progressGradient-${variant}`;

  // Colors based on variant
  const colors = variant === 'calories'
    ? { start: isGoalMet ? '#22c55e' : '#f97316', end: isGoalMet ? '#16a34a' : '#ea580c' }  // orange for calories
    : { start: isGoalMet ? '#22c55e' : '#f5b800', end: isGoalMet ? '#16a34a' : '#d97706' }; // amber for protein

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      {/* White background container */}
      {showCenter && (
        <div
          className="absolute bg-card rounded-full shadow-sm"
          style={{
            width: size - strokeWidth * 2,
            height: size - strokeWidth * 2,
          }}
        />
      )}
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e1db"
          strokeWidth={strokeWidth}
        />
        {/* Gradient definition for progress */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-700 ease-out',
            isGoalMet && 'shimmer-on-complete'
          )}
        />
      </svg>
      {showCenter && (
        <div className="absolute flex flex-col items-center justify-center">
          {label && (
            <span className="text-xs text-muted-foreground mb-0.5">{label}</span>
          )}
          <span className={cn(
            'text-4xl font-bold transition-colors duration-300',
            isGoalMet ? 'text-green-500' : 'text-foreground'
          )}>
            {Math.round(current)}
          </span>
          <span className="text-sm text-muted-foreground">
            / {goal}{unit}
          </span>
          {isGoalMet && (
            <span className="text-xs text-green-500 font-medium mt-1 animate-slide-up-fade">
              Goal met!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
