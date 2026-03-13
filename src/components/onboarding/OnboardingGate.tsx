import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useSettings } from '@/hooks/useProteinData';
import { db } from '@/db';
import { Onboarding } from '@/pages/Onboarding';

// Quick synchronous check of localStorage to avoid flash while async DB loads
function wasOnboardingCompleted(): boolean {
  // If user explicitly re-ran onboarding, treat as not completed
  if (sessionStorage.getItem('rerun-onboarding') === 'true') {
    return false;
  }
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
  const decided = useRef(false);

  useEffect(() => {
    if (!settingsLoaded || decided.current) return;

    // If user explicitly re-ran onboarding (via settings), always show it
    const wasExplicitRerun = sessionStorage.getItem('rerun-onboarding') === 'true';
    if (wasExplicitRerun) {
      sessionStorage.removeItem('rerun-onboarding');
      decided.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(true);
      setChecked(true);
      return;
    }

    // Already completed onboarding
    if (settings.onboardingCompleted) {
      decided.current = true;
      setChecked(true);
      setShowOnboarding(false);
      return;
    }

    // Check if existing user (has food entries) — skip onboarding for them
    db.foodEntries.count().then((count) => {
      if (decided.current) return;
      decided.current = true;
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
