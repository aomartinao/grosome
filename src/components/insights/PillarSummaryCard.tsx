import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeeklyPillarChart } from '@/components/tracking/WeeklyPillarChart';
import type { ChartDataPoint } from '@/hooks/useTrackingData';

interface PillarSummaryCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  title: string;
  stat: string;
  statLabel: string;
  goalsMet: string;
  chartData?: ChartDataPoint[];
  chartColor?: string;
  chartBgColor?: string;
  chartUnit?: string;
  trend?: 'improving' | 'consistent' | 'declining' | 'new';
  onClick: () => void;
}

export function PillarSummaryCard({
  icon: Icon,
  iconColor,
  iconBgColor,
  title,
  stat,
  statLabel,
  goalsMet,
  chartData,
  chartColor,
  chartBgColor,
  chartUnit,
  trend,
  onClick,
}: PillarSummaryCardProps) {
  const trendLabel = trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : null;
  const trendColor = trend === 'improving' ? 'text-green-500' : trend === 'declining' ? 'text-red-500' : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-card rounded-2xl shadow-sm border border-border/50',
        'transition-all duration-200 active:scale-[0.98] cursor-pointer'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-0">
        <div className={cn('p-2 rounded-xl flex-shrink-0', iconBgColor)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold leading-tight">{stat}</span>
            <span className="text-xs text-muted-foreground">{statLabel}</span>
            {trendLabel && (
              <span className={cn('text-xs font-medium', trendColor)}>{trendLabel}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{goalsMet}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Mini chart */}
      {chartData && chartData.length > 0 && chartColor && chartBgColor && chartUnit && (
        <div className="px-4 pb-3 pt-2 pointer-events-none">
          <WeeklyPillarChart
            data={chartData}
            label=""
            unit={chartUnit}
            color={chartColor}
            bgColor={chartBgColor}
            compact
          />
        </div>
      )}

      {/* No chart - add bottom padding */}
      {(!chartData || chartData.length === 0) && <div className="pb-4" />}
    </button>
  );
}
