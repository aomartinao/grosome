import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { UnifiedChat } from '@/pages/UnifiedChat';
import { Insights } from '@/pages/Insights';
import { InsightsDetail } from '@/pages/InsightsDetail';
import { Settings } from '@/pages/Settings';
import { SwipeProvider } from '@/context/SwipeContext';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';
import { initializeAuth } from '@/store/useAuthStore';
import { Analytics } from '@vercel/analytics/react';

// Coach page - unified experience for all users
function CoachPage() {
  return <UnifiedChat />;
}

function App() {
  // Initialize Supabase auth on app load
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <SwipeProvider>
      <BrowserRouter>
        <OnboardingGate>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="coach" element={<ErrorBoundary><CoachPage /></ErrorBoundary>} />
              {/* Legacy routes redirect to /coach */}
              <Route path="chat" element={<Navigate to="/coach" replace />} />
              <Route path="advisor" element={<Navigate to="/coach" replace />} />
              <Route path="insights" element={<ErrorBoundary><Insights /></ErrorBoundary>} />
              <Route path="insights/:pillar" element={<ErrorBoundary><InsightsDetail /></ErrorBoundary>} />
              {/* Legacy routes redirect to /insights */}
              <Route path="history" element={<Navigate to="/insights" replace />} />
              <Route path="reports" element={<Navigate to="/insights" replace />} />
              <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
            </Route>
          </Routes>
        </OnboardingGate>
      </BrowserRouter>
      <Toaster />
      <Analytics />
    </SwipeProvider>
  );
}

export default App;
// Force redeploy Wed Feb  4 00:18:22 CET 2026
