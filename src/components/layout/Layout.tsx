import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { FloatingAddButton } from './FloatingAddButton';
import { useAuthStore } from '@/store/useAuthStore';
import { useStore } from '@/store/useStore';

export function Layout() {
  const location = useLocation();
  const { syncData, isSyncing, user } = useAuthStore();
  const { showFloatingAddButton } = useStore();

  // Detect if running as standalone PWA (Arc browser adds its own toolbar)
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);
    return () => mediaQuery.removeEventListener('change', checkStandalone);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    await syncData();
  }, [syncData, user]);

  // Disable pull-to-refresh on coach page (has its own scroll container)
  const disablePullToRefresh = location.pathname === '/coach' || location.pathname === '/chat' || location.pathname === '/advisor';

  // Increase bottom padding in standalone mode to account for Arc's PWA toolbar
  const bottomPadding = isStandalone ? 'pb-32' : 'pb-20';

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <Header />
      {disablePullToRefresh ? (
        <div className={`flex-1 ${bottomPadding} overflow-hidden flex flex-col min-h-0`}>
          <Outlet />
        </div>
      ) : (
        <PullToRefresh
          onRefresh={handleRefresh}
          disabled={isSyncing}
          className={`flex-1 ${bottomPadding}`}
        >
          <Outlet />
        </PullToRefresh>
      )}
      <MobileNav />

      {/* Floating Add Button - rendered at root level to stay fixed */}
      {showFloatingAddButton && <FloatingAddButton />}
    </div>
  );
}
