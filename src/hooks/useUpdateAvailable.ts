import { useState, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function useUpdateAvailable() {
  const [isChecking, setIsChecking] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
      if (registration) {
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error);
    },
  });

  // When a new SW takes control, reload to activate
  useEffect(() => {
    const handler = () => window.location.reload();
    navigator.serviceWorker?.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', handler);
  }, []);

  const updateApp = () => {
    updateServiceWorker(true);
  };

  // Manual check: triggers registration.update(), waits for detection
  const checkForUpdate = async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const reg = registrationRef.current
        ?? await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.update();
        // Give browser time to detect the new SW
        await new Promise(r => setTimeout(r, 1500));
        // Check if a waiting worker appeared
        if (reg.waiting) {
          return true;
        }
      }
      return needRefresh;
    } finally {
      setIsChecking(false);
    }
  };

  return { updateAvailable: needRefresh, updateApp, checkForUpdate, isChecking };
}
