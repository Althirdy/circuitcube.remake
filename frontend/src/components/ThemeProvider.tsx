import { useEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext, themeStorageKey } from '../lib/theme';
import type { Theme } from '../lib/theme';

function initialPreference(): Theme | null {
  try {
    const value = localStorage.getItem(themeStorageKey);
    return value === 'light' || value === 'dark' ? value : null;
  } catch { return null; }
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(initialPreference);
  const [system, setSystem] = useState<Theme>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const theme = preference ?? system;
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystem(media.matches ? 'dark' : 'light');
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setPreference(next);
    try { localStorage.setItem(themeStorageKey, next); }
    catch { /* The preference still works in memory if browser storage is blocked. */ }
  };
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
