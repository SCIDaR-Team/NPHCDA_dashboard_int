import { create } from 'zustand';
import type { SnapshotFacts } from '@/data/scopedEngine';
import type { FacilityRow } from '@/data/types';

interface SnapshotStore {
  /** Compact per-source fact table (slim records) the ETL ships; the compound-scope
   *  engine (src/data/scopedEngine.ts) re-aggregates it through buildIndicators. */
  facts: SnapshotFacts | null;
  /** Real facility roster — used to scope the functional-status split by geo/type/donor. */
  facilities: FacilityRow[];
  setFacts: (facts: SnapshotFacts | null) => void;
  setFacilities: (facilities: FacilityRow[]) => void;
}

/**
 * Global store for the snapshot fact table + roster. Populated by the data source
 * when the snapshot loads; read synchronously by the compound-scope engine.
 */
export const useSnapshotStore = create<SnapshotStore>((set) => ({
  facts: null,
  facilities: [],
  setFacts: (facts) => set({ facts }),
  setFacilities: (facilities) => set({ facilities }),
}));
