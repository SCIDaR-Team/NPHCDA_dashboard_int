import type { FacilityRow } from '../types';
import { ALL_STATES } from '../geo/states';
import {
  hashStr,
  pseudo,
  lgasForState,
  wardsForLga,
  FACILITY_NAME_POOL,
} from '../calculations';

/**
 * Procedurally-generated facility matrix (preserved generator).
 *
 * Two LGAs per state, 3–4 facilities each, all seeded deterministically so the
 * mock matrix is stable between reloads. A real ApiDataSource would replace this
 * with the live facility register while keeping the same `FacilityRow` shape.
 */
export function buildFacilityDataset(): FacilityRow[] {
  const rows: FacilityRow[] = [];
  ALL_STATES.forEach((state) => {
    lgasForState(state)
      .slice(0, 2)
      .forEach((lga) => {
        const wards = wardsForLga(lga);
        const nFac = 3 + (hashStr(lga) % 2);
        for (let i = 0; i < nFac; i++) {
          const fname = FACILITY_NAME_POOL[hashStr(lga + i) % FACILITY_NAME_POOL.length];
          const seed = lga + i + fname;
          const ward = wards[hashStr(seed + 'ward') % wards.length];
          const type = pseudo(seed + 'type') > 0.82 ? 'CEmONC' : 'BEmONC';
          const statusRoll = pseudo(seed + 'status');
          const status =
            statusRoll > 0.7
              ? 'L2'
              : statusRoll > 0.4
                ? 'L1'
                : statusRoll > 0.15
                  ? 'Partial'
                  : 'Non-functional';
          const tracer = Math.round(30 + pseudo(seed + 'tracer') * 65);
          const satisfaction = Math.round(35 + pseudo(seed + 'sat') * 60);
          const penta3 = Math.round(40 + pseudo(seed + 'p3') * 58);
          const maternalDeaths = Math.round(pseudo(seed + 'md') * 4);
          const facilityName = fname + ' #' + (i + 1);
          rows.push({
            state,
            lga,
            ward,
            facility: facilityName,
            type,
            status,
            tracer,
            satisfaction,
            penta3,
            maternalDeaths,
          });
        }
      });
  });
  return rows;
}

export const FD_DATA: FacilityRow[] = buildFacilityDataset();
