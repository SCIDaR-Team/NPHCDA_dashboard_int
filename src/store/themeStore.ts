import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
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
      toggle: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        apply(next);
        set({ theme: next });
      },
      setTheme: (t) => {
        apply(t);
        set({ theme: t });
      },
    }),
    {
      name: 'nphcda-theme',
      onRehydrateStorage: () => (state) => {
        if (state) apply(state.theme);
      },
    }
  )
);
