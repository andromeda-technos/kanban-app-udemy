import { useEffect, useState } from 'react';

/** Current timestamp, refreshed every `intervalMs` (and right away when the tab becomes visible). */
export const useNow = (intervalMs = 1000, enabled = true): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);

  return now;
};
