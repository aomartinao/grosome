import { useState, useEffect } from 'react';
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
  // Detect if running as standalone PWA (Arc browser adds its own toolbar)
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check for standalone mode (PWA installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // Listen for changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);
    return () => mediaQuery.removeEventListener('change', checkStandalone);
  }, []);

  return (
    <nav className={cn(
      "fixed left-4 right-4 z-50 floating-nav safe-area-inset-bottom",
      isStandalone ? "bottom-14" : "bottom-4" // Extra space for Arc's PWA toolbar
    )}>
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 h-11 gap-0.5 text-[11px] transition-all duration-300 rounded-full mx-0.5',
                isActive
                  ? 'text-amber-600 scale-105'
                  : 'text-gray-500 hover:text-gray-700 active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'relative p-1.5 rounded-full transition-all duration-300',
                  isActive && 'bg-amber-500/15'
                )}>
                  <Icon className={cn(
                    'h-5 w-5 transition-all duration-300',
                    isActive && 'drop-shadow-sm'
                  )} />
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-md -z-10" />
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
