import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Real-clock timestamp OTP cooldown hook.
 * Continues counting accurately while the user switches to Gmail/external apps
 * and snaps immediately to elapsed time when the app returns to foreground.
 */
export function useOtpCooldown(defaultSeconds = 120) {
  const [remainingSec, setRemainingSec] = useState(0);
  const endAtRef = useRef<number | null>(null);

  const syncRemaining = useCallback(() => {
    const endAt = endAtRef.current;
    if (!endAt) {
      setRemainingSec(0);
      return;
    }
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (left <= 0) {
      endAtRef.current = null;
      setRemainingSec(0);
    } else {
      setRemainingSec(left);
    }
  }, []);

  const startCooldown = useCallback(
    (seconds = defaultSeconds) => {
      const safeSec = Math.max(0, Math.round(seconds));
      if (safeSec <= 0) {
        endAtRef.current = null;
        setRemainingSec(0);
        return;
      }
      endAtRef.current = Date.now() + safeSec * 1000;
      setRemainingSec(safeSec);
    },
    [defaultSeconds]
  );

  const resetCooldown = useCallback(() => {
    endAtRef.current = null;
    setRemainingSec(0);
  }, []);

  useEffect(() => {
    if (remainingSec <= 0 || !endAtRef.current) return;

    const tick = setInterval(syncRemaining, 250);
    const appSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        syncRemaining();
      }
    });

    return () => {
      clearInterval(tick);
      appSub.remove();
    };
  }, [remainingSec > 0, syncRemaining]);

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return {
    remainingSec,
    formattedTime,
    startCooldown,
    resetCooldown,
  };
}
