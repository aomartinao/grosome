import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { useAuthStore } from '@/store/useAuthStore';
import { useCallback } from 'react';

export function Layout() {
  const location = useLocation();
  const { syncData, isSyncing, user } = useAuthStore();

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    await syncData();
  }, [syncData, user]);

  const disablePullToRefresh = location.pathname === '/coach' || location.pathname === '/chat' || location.pathname === '/advisor';

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <Header />
      {disablePullToRefresh ? (
        <div className="flex-1 pb-20 overflow-hidden flex flex-col min-h-0">
          <Outlet />
        </div>
      ) : (
        <PullToRefresh
          onRefresh={handleRefresh}
          disabled={isSyncing}
          className="flex-1 pb-20"
        >
          <Outlet />
        </PullToRefresh>
      )}
      <MobileNav />
    </div>
  );
}
