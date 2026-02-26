import { useState, useRef, useCallback, useEffect } from 'react';
import { Home, MessageSquare, Plus, Sparkles, Settings, Camera, Image as ImageIcon } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { compressImage, triggerHaptic } from '@/lib/utils';

const LONG_PRESS_DURATION = 400;

const navItems = [
  { to: '/', icon: Home, label: 'Today', end: true },
  { to: '/coach', icon: MessageSquare, label: 'Chat', end: true },
  // Plus button goes here (index 2)
  { to: '/insights', icon: Sparkles, label: 'Insights', end: false },
  { to: '/settings', icon: Settings, label: 'Settings', end: true },
];

export function MobileNav() {
  const navigate = useNavigate();
  const { setPendingImageFromHome } = useStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const menuJustOpenedRef = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handlePlusTouchStart = useCallback(() => {
    isLongPressRef.current = false;
    menuJustOpenedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      menuJustOpenedRef.current = true;
      setIsExpanded(true);
      triggerHaptic('medium');
    }, LONG_PRESS_DURATION);
  }, []);

  const handlePlusTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (menuJustOpenedRef.current) {
      menuJustOpenedRef.current = false;
      isLongPressRef.current = false;
      return;
    }
    if (isExpanded) {
      setIsExpanded(false);
    } else if (!isLongPressRef.current) {
      navigate('/coach');
    }
    isLongPressRef.current = false;
  }, [isExpanded, navigate]);

  const handleFileChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'camera' | 'gallery'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setPendingImageFromHome(compressed, source);
        navigate('/coach');
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }
    e.target.value = '';
    setIsExpanded(false);
  }, [navigate, setPendingImageFromHome]);

  useEffect(() => {
    if (!isExpanded) return;
    const handler = () => setIsExpanded(false);
    const timer = setTimeout(() => document.addEventListener('touchstart', handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', handler);
    };
  }, [isExpanded]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const renderNavItem = ({ to, icon: Icon, label, end }: typeof navItems[0]) => (
    <NavLink
      key={to}
      to={to}
      end={end}
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
            <Icon className={cn('h-5 w-5 transition-all duration-300', isActive && 'drop-shadow-sm')} />
            {isActive && <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-md -z-10" />}
          </div>
          <span className={cn('font-medium transition-all duration-300', isActive ? 'opacity-100' : 'opacity-70')}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );

  return (
    <>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => handleFileChange(e, 'camera')} className="hidden" />
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={e => handleFileChange(e, 'gallery')} className="hidden" />

      {isExpanded && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsExpanded(false)} />
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex gap-3">
            <button
              className="h-12 w-12 rounded-full shadow-lg bg-secondary text-secondary-foreground flex items-center justify-center active:scale-95"
              onClick={() => { galleryInputRef.current?.click(); triggerHaptic('light'); }}
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              className="h-12 w-12 rounded-full shadow-lg bg-secondary text-secondary-foreground flex items-center justify-center active:scale-95"
              onClick={() => { cameraInputRef.current?.click(); triggerHaptic('light'); }}
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>
        </>
      )}

      <nav className="fixed bottom-4 left-4 right-4 z-50 floating-nav">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.slice(0, 2).map(renderNavItem)}

          <div className="flex flex-col items-center justify-center flex-1 mx-0.5">
            <button
              className={cn(
                'relative -mt-5 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-200',
                isExpanded ? 'rotate-45 bg-muted text-muted-foreground' : 'active:scale-95'
              )}
              onTouchStart={handlePlusTouchStart}
              onTouchEnd={handlePlusTouchEnd}
              onMouseDown={handlePlusTouchStart}
              onMouseUp={handlePlusTouchEnd}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {navItems.slice(2).map(renderNavItem)}
        </div>
      </nav>
    </>
  );
}
