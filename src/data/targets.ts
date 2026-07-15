/**
 * National targets & benchmarks.
 *
 * These are PROGRAMMATIC POLICY TARGETS (NPHCDA / national RMNCAH+N goals), not
 * measured data — kept separate from the snapshot on purpose so the real-data-only
 * discipline is never diluted. Each entry is the target performance level on the
 * indicator's own 0–100 percentage scale (higher is better). Only percentage-style,
 * higher-is-better indicators carry a target here; rate/count/inverse indicators
 * whose displayed value isn't a plain 0–100 percentage are intentionally omitted so
 * a variance is never shown against an incomparable scale.
 *
 * Adjust these in one place to reflect updated national commitments.
 */
export const NATIONAL_TARGETS: Record<string, number> = {
  'Proportion of children &lt;1 year who received Penta 3': 95,
  'Proportion of children &lt;1 year who received Measles 1': 90,
  'Proportion of deliveries attended by a skilled birth attendant': 80,
  '% of women with a live birth who attended ANC 1': 90,
  '% of women with a live birth who attended ANC 4': 70,
  '% of family planning clients using modern contraceptives': 65,
  'Proportion of facilities with a minimum of 4 SBAs': 70,
  'Proportion of PHCs with all six tracer commodities available*': 80,
  'Proportion of facilities with the PPH bundle available*': 80,
  'Proportion of wards / main PHCs with functional cold-chain equipment (SDD/CCE)': 90,
  'Proportion of visited PHCs offering the full essential service package*': 80,
  'Proportion of visited PHCs with functional maternal health equipment*': 80,
  'Proportion of BHCPF facilities that received their quarterly disbursement': 90,
  'Proportion of RMNCH TWG meetings conducted as planned': 90,
  'Facility functional status per state (L1 / L2 / partial / non-functional)': 80,
};

/** A human note that appears wherever a variance is shown, to keep provenance clear. */
export const TARGET_SOURCE_NOTE = 'National programmatic target (policy benchmark, not measured data).';

export interface Variance {
  target: number;
  actual: number;
  /** actual − target, in percentage points (positive = at/above target). */
  delta: number;
  meets: boolean;
}

/** Variance of an actual 0–100 percentage against this indicator's national target,
 *  or null when the indicator has no target or the value isn't a usable percentage. */
export function varianceFor(indicatorName: string, actualPct: number | undefined): Variance | null {
  const target = NATIONAL_TARGETS[indicatorName];
  if (target == null || actualPct == null || actualPct <= 0) return null;
  const delta = +(actualPct - target).toFixed(1);
  return { target, actual: actualPct, delta, meets: delta >= 0 };
}
