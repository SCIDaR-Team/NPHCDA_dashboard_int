import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setCvdSafe } from '@/lib/heatMode';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  /** Colour-blind-safe (CVD) heat scale — swaps red/amber/green for viridis. */
  colorBlindSafe: boolean;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  toggleColorBlindSafe: () => void;
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      colorBlindSafe: false,
      toggle: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        apply(next);
        set({ theme: next });
      },
      setTheme: (t) => {
        apply(t);
        set({ theme: t });
      },
      toggleColorBlindSafe: () => {
        const next = !get().colorBlindSafe;
        setCvdSafe(next); // sync the pure-helper mirror read by heatColor
        set({ colorBlindSafe: next });
      },
    }),
    {
      name: 'nphcda-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          apply(state.theme);
          setCvdSafe(!!state.colorBlindSafe);
        }
      },
    }
  )
);
