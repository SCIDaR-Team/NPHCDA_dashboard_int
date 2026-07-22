import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingStore {
  /** Persisted: whether the user has completed/skipped the first-run tour. */
  seen: boolean;
  /** Transient: whether the tour overlay is currently open. */
  open: boolean;
  /** Open the tour on first run (no-op once seen). */
  maybeStart: () => void;
  /** Force the tour open (e.g. "Replay tour" from Help). */
  start: () => void;
  /** Close + mark as seen. */
  finish: () => void;
}

/** First-run onboarding tour state. Only `seen` is persisted, so replaying the tour
 *  in one session never permanently re-arms it. */
export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      seen: false,
      open: false,
      maybeStart: () => {
        if (!get().seen) set({ open: true });
      },
      start: () => set({ open: true }),
      finish: () => set({ open: false, seen: true }),
    }),
    { name: 'nphcda-onboarding', partialize: (s) => ({ seen: s.seen }) }
  )
);
