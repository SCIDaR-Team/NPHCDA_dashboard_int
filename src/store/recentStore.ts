import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RecentKind = 'page' | 'indicator' | 'facility';

export interface RecentItem {
  /** Stable identity (href for pages, name for indicators, key for facilities). */
  id: string;
  kind: RecentKind;
  label: string;
  href: string;
  at: number;
}

interface RecentStore {
  items: RecentItem[];
  record: (item: Omit<RecentItem, 'at'>) => void;
  clear: () => void;
}

const CAP = 8;

/** Recently-viewed pages, indicators and facilities — a quick way back to where the
 *  user just was. Deduped by id (most-recent first), capped, persisted locally. */
export const useRecentStore = create<RecentStore>()(
  persist(
    (set) => ({
      items: [],
      record: (item) =>
        set((s) => ({
          items: [{ ...item, at: Date.now() }, ...s.items.filter((i) => i.id !== item.id)].slice(0, CAP),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'nphcda-recent' }
  )
);
