import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AnnotationTarget = 'indicator' | 'facility';

export interface Annotation {
  id: string;
  targetType: AnnotationTarget;
  /** Indicator name, or a facility key (state|lga|facility). */
  targetId: string;
  /** Short human label of the target, so the "all notes" view reads without lookups. */
  targetLabel: string;
  text: string;
  author: string;
  createdAt: number;
}

interface AnnotationStore {
  annotations: Annotation[];
  add: (a: Omit<Annotation, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  /** Notes for one target, newest first. */
  forTarget: (targetType: AnnotationTarget, targetId: string) => Annotation[];
}

/**
 * User annotations on indicators and facilities, persisted locally. A lightweight
 * analyst notebook — attach context, caveats or follow-ups to any indicator or
 * facility, surfaced on its deep-dive / profile. Local-only (no backend), so notes
 * live in the browser until an audited notes service exists.
 */
export const useAnnotationStore = create<AnnotationStore>()(
  persist(
    (set, get) => ({
      annotations: [],
      add: (a) =>
        set((s) => ({
          annotations: [
            { ...a, id: Math.random().toString(36).slice(2, 10), createdAt: Date.now() },
            ...s.annotations,
          ],
        })),
      remove: (id) => set((s) => ({ annotations: s.annotations.filter((n) => n.id !== id) })),
      forTarget: (targetType, targetId) =>
        get()
          .annotations.filter((n) => n.targetType === targetType && n.targetId === targetId)
          .sort((a, b) => b.createdAt - a.createdAt),
    }),
    { name: 'nphcda-annotations' }
  )
);
