import { stateMeasures } from '@/data/calculations';
import type { Indicator } from '@/data/types';

/**
 * Curated cross-block indicators shown in the state-profile modal — the exact set
 * (and order) the reference dashboard uses. Names match our catalogue verbatim.
 * These same indicators define the composite map score (see stateCompositeScore),
 * so the map and the profile always agree on what a state's readiness looks like.
 */
export const PROFILE_INDICATOR_NAMES: string[] = [
  'Facility functional status per state (L1 / L2 / partial / non-functional)',
  'Proportion of BHCPF facilities that received their quarterly disbursement',
  'Proportion of facilities with a minimum of 4 SBAs',
  'Proportion of PHCs with all six tracer commodities available*',
  'Proportion of children &lt;1 year who received Penta 3',
  'Maternal Mortality Ratio - BHCPF vs. non-BHCPF facilities',
  'Patient satisfaction composite*',
  'Proportion of RMNCH TWG meetings conducted as planned',
];

/**
 * Uniform composite readiness score for a state: the average 0–100 "goodness" of the
 * curated profile indicators that have a REAL measurement for the state (inverse-aware).
 * Every state is computed the same way, so the map colouring is directly comparable.
 * Returns null when none of the indicators have data (→ the map greys the state out,
 * and its profile would be empty too — the two stay consistent).
 */
export function stateCompositeScore(state: string, indByName: Record<string, Indicator>): number | null {
  let sum = 0;
  let cnt = 0;
  for (const name of PROFILE_INDICATOR_NAMES) {
    const ind = indByName[name];
    if (!ind) continue;
    const m = stateMeasures(name)[state];
    if (!m) continue;
    sum += ind.inverse ? 100 - m.pct : m.pct;
    cnt++;
  }
  return cnt ? +(sum / cnt).toFixed(1) : null;
}
