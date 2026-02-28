import { cn } from '@/lib/utils';
import type { MenuPick } from '@/services/ai/unified';

interface MenuPicksCarouselProps {
    picks: MenuPick[];
    className?: string;
}

export function MenuPicksCarousel({ picks, className }: MenuPicksCarouselProps) {
    if (!picks || picks.length === 0) return null;

    return (
        <div className={cn("w-full overflow-x-auto pb-4 pt-2 -mx-4 px-4 scrollbar-hide snap-x", className)}>
            <div className="flex gap-3 w-max">
                {picks.map((pick, i) => (
                    <div
                        key={i}
                        className="snap-start shrink-0 w-[240px] bg-card rounded-2xl p-4 shadow-sm border border-border/50 flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-semibold text-foreground line-clamp-2">{pick.name}</h4>
                                <div className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap self-start">
                                    ~{pick.protein}g
                                </div>
                            </div>
                            {pick.calories && (
                                <div className="text-xs text-amber-600 font-medium mb-3">
                                    {pick.calories} kcal
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-snug">
                            {pick.why}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
