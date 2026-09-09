import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';
export const themeStorageKey = 'circuitcube.theme';
export const sceneColors = {
  light: { background: '#f1f5f9', grid: '#cbd5e1', section: '#94a3b8', selected: '#0f766e', hover: '#5eead4', invalid: '#b91c1c' },
  dark: { background: '#0f172a', grid: '#334155', section: '#64748b', selected: '#2dd4bf', hover: '#99f6e4', invalid: '#fca5a5' },
} as const;
export const ThemeContext = createContext({ theme: 'light' as Theme, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);
