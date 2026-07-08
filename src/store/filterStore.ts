import { create } from 'zustand';
import type { FilterState } from '@/data/types';

export const EMPTY_FILTER: FilterState = {
  search: '',
  donor: '',
  source: '',
  zone: '',
  state: '',
  lga: '',
  ward: '',
  facilityType: '',
  facility: '',
  year: '',
  month: '',
};

interface FilterStore extends FilterState {
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
  apply: (next: FilterState) => void;
  /** Number of active (non-empty) location/donor filters. */
  activeCount: () => number;
}

/**
 * Global filter scope. The dashboard pages read this and re-derive scoped values
 * through the preserved calculation functions (effectiveIndicatorValue, etc.).
 */
export const useFilterStore = create<FilterStore>((set, get) => ({
  ...EMPTY_FILTER,
  set: (patch) => set(patch),
  reset: () => set({ ...EMPTY_FILTER }),
  apply: (next) => set({ ...next }),
  activeCount: () => {
    const s = get();
    return (['donor', 'source', 'zone', 'state', 'lga', 'ward', 'facilityType', 'facility', 'search', 'year', 'month'] as const).filter(
      (k) => s[k]
    ).length;
  },
}));

/** Stable selector for just the data fields (no actions) — useful for calculations. */
export function pickFilter(s: FilterStore): FilterState {
  return {
    search: s.search,
    donor: s.donor,
    source: s.source,
    zone: s.zone,
    state: s.state,
    lga: s.lga,
    ward: s.ward,
    facilityType: s.facilityType,
    facility: s.facility,
    year: s.year,
    month: s.month,
  };
}
