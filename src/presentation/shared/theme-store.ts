import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

function readInitial(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const prefs = window.electronAPI?.preferences?.getSync?.();
    if (prefs?.theme === 'light' || prefs?.theme === 'dark') return prefs.theme;
  } catch {
    /* preload not ready / non-Electron context */
  }
  return 'dark';
}

function apply(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
}

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readInitial(),
  setMode: (mode) => {
    apply(mode);
    try {
      void window.electronAPI?.preferences?.setTheme({ theme: mode });
    } catch {
      /* ignore — UI state already updated */
    }
    set({ mode });
  },
  toggle: () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    get().setMode(next);
  },
}));

// Apply the initial theme synchronously at module import so the very first
// paint already uses the persisted mode.
apply(useThemeStore.getState().mode);
