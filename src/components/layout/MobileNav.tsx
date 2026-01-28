import { Home, MessageSquare, Calendar, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/coach', icon: MessageSquare, label: 'Coach' },
  { to: '/history', icon: Calendar, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileNav() {
  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 floating-nav safe-area-inset-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 h-11 gap-0.5 text-[11px] transition-all duration-300 rounded-full mx-0.5',
                isActive
                  ? 'text-primary scale-105'
                  : 'text-muted-foreground/70 hover:text-foreground active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'relative p-1.5 rounded-full transition-all duration-300',
                  isActive && 'bg-primary/15'
                )}>
                  <Icon className={cn(
                    'h-5 w-5 transition-all duration-300',
                    isActive && 'drop-shadow-sm'
                  )} />
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-primary/10 blur-md -z-10" />
                  )}
                </div>
                <span className={cn(
                  'font-medium transition-all duration-300',
                  isActive ? 'opacity-100' : 'opacity-70'
                )}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
