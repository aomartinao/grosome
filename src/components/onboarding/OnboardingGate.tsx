import { useState, useEffect, type ReactNode } from 'react';
import { useSettings } from '@/hooks/useProteinData';
import { db } from '@/db';
import { Onboarding } from '@/pages/Onboarding';

// Quick synchronous check of localStorage to avoid flash while async DB loads
function wasOnboardingCompleted(): boolean {
  try {
    const raw = localStorage.getItem('grosome-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return !!parsed?.state?.settings?.onboardingCompleted;
    }
  } catch { /* ignore */ }
  return false;
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { settings, updateSettings, settingsLoaded } = useSettings();
  const [checked, setChecked] = useState(wasOnboardingCompleted);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!settingsLoaded) return;

    // Already completed onboarding
    if (settings.onboardingCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecked(true);
      setShowOnboarding(false);
      return;
    }

    // Check if existing user (has food entries) — skip onboarding for them
    // BUT: if user explicitly re-ran onboarding (via settings), always show it
    const wasExplicitRerun = sessionStorage.getItem('rerun-onboarding') === 'true';
    if (wasExplicitRerun) {
      sessionStorage.removeItem('rerun-onboarding');
      setShowOnboarding(true);
      setChecked(true);
      return;
    }

    db.foodEntries.count().then((count) => {
      if (count > 0) {
        updateSettings({ onboardingCompleted: true });
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
      setChecked(true);
    });
  }, [settingsLoaded, settings.onboardingCompleted, updateSettings]);

  if (!settingsLoaded || !checked) return null;
  if (showOnboarding) return <Onboarding />;
  return <>{children}</>;
}
