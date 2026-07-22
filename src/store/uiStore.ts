import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  /** Desktop nav rail collapsed to an icon-only strip. */
  navCollapsed: boolean;
  /** Sidebar nav groups that are currently expanded, keyed by group label. */
  openNavGroups: Record<string, boolean>;
  toggleNav: () => void;
  setNavCollapsed: (collapsed: boolean) => void;
  toggleNavGroup: (label: string) => void;
  setNavGroupOpen: (label: string, open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      navCollapsed: false,
      openNavGroups: {},
      toggleNav: () => set({ navCollapsed: !get().navCollapsed }),
      setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
      toggleNavGroup: (label) =>
        set({ openNavGroups: { ...get().openNavGroups, [label]: !get().openNavGroups[label] } }),
      setNavGroupOpen: (label, open) =>
        set({ openNavGroups: { ...get().openNavGroups, [label]: open } }),
    }),
    { name: 'nphcda-ui' }
  )
);
