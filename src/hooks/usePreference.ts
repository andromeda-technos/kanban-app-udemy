import { useCallback, useEffect, useState } from 'react';

const EVENT = 'kanban-preference';

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

/**
 * Small per-browser preference (e.g. pixel font on/off) kept in localStorage.
 * Every component using the same key stays in sync, including other tabs.
 */
export const usePreference = <T,>(key: string, fallback: T): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const onChange = (e: Event) => {
      const k = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail;
      if (k === key) setValue(read(key, fallback));
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* private mode: keep it in memory only */
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key]
  );

  return [value, update];
};

export const PREF_KEYS = {
  PIXEL_FONT: 'kanban_pixel_font_v1',
  CLAWD: 'kanban_clawd_v1',
  PIXEL_BG: 'kanban_pixel_bg_v1',
} as const;
