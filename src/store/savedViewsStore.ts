import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FilterState } from '@/data/types';

export interface SavedView {
  id: string;
  name: string;
  page: string;
  filter: FilterState;
  createdAt: number;
}

interface SavedViewsStore {
  views: SavedView[];
  add: (view: Omit<SavedView, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

/** Bookmarked dashboards: a page + filter scope the user can jump back to. */
export const useSavedViewsStore = create<SavedViewsStore>()(
  persist(
    (set) => ({
      views: [],
      add: (view) =>
        set((s) => ({
          views: [
            ...s.views,
            { ...view, id: Math.random().toString(36).slice(2, 10), createdAt: Date.now() },
          ],
        })),
      remove: (id) => set((s) => ({ views: s.views.filter((v) => v.id !== id) })),
      rename: (id, name) =>
        set((s) => ({ views: s.views.map((v) => (v.id === id ? { ...v, name } : v)) })),
    }),
    { name: 'nphcda-saved-views' }
  )
);
