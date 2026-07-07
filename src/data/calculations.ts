/**
 * Calculation & scoping engine — REAL DATA ONLY.
 *
 * The colour scale, goodness/status helpers and trend granularity transforms are
 * ported verbatim from the original dashboard. All filter-aware scoping now reads
 * ONLY the real disaggregated measurements the ETL emits (state / zone / donor /
 * LGA / facility / period). Nothing is fabricated: when a filter selects a scope
 * we have no real measurement for, the caller renders a "No data for this scope"
 * empty state. There is no pseudo-random jitter anywhere.
 */

import type { FilterState, Indicator, KpiCard, Split4 } from './types';
import { ALL_STATES } from './geo/states';
import { LGAS_BY_STATE } from './geo/lgas';
import { SRH_STATES, SFM_STATES, LCB_STATES } from './catalogue';
import { scopedMeasurements, stateMeasures, facilityMeasures, functionalStatusScopedSplit, mamiiFacilityGeo } from './scopedEngine';

// Re-export the single-dimension distributions (deep-dive chart / overview map),
// which are derived from the same compound engine so they never diverge.
export { stateMeasures, facilityMeasures, mamiiFacilityGeo };

/** Below this sample size, a scoped figure is flagged as a small sample. */
export const SMALL_N = 30;

/* ------------------------------------------------------------------ *
 * Colour scale: red → amber → green across a 0–100 "goodness" score.
 * ------------------------------------------------------------------ */
export function heatColor(score: number): string {
  const stops: [number, number[]][] = [
    [0, [194, 86, 44]],
    [50, [201, 162, 39]],
    [100, [46, 139, 87]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (score >= stops[i][0] && score <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const t = (score - lo[0]) / (hi[0] - lo[0] || 1);
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function linregress(values: (number | null)[]): (number | null)[] {
  // Fit over the finite points only; leave gaps (null) as gaps in the output.
  const pairs = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => typeof p[1] === 'number' && isFinite(p[1]));
  if (pairs.length < 2) return values.map(() => null);
  const n = pairs.length;
  const xm = pairs.reduce((a, [x]) => a + x, 0) / n;
  const ym = pairs.reduce((a, [, y]) => a + y, 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of pairs) {
    num += (x - xm) * (y - ym);
    den += (x - xm) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = ym - slope * xm;
  return values.map((v, x) => (typeof v === 'number' && isFinite(v) ? +(slope * x + intercept).toFixed(2) : null));
}

/* ------------------------------------------------------------------ *
 * Indicator goodness + colour.
 * ------------------------------------------------------------------ */
export function goodnessFor(ind: Pick<Indicator, 'inverse' | 'pct'>): number {
  return ind.inverse ? 100 - ind.pct : ind.pct;
}

export function barColorFor(ind: Pick<Indicator, 'inverse' | 'pct'>): string {
  if (ind.pct <= 0) return '#C2562C';
  return heatColor(goodnessFor(ind));
}

export interface StatusInfo {
  level: 'good' | 'mid' | 'poor';
  label: 'Good' | 'Fair' | 'Poor';
}
export function statusFor(value: number, inverse?: boolean): StatusInfo {
  const good = inverse ? value <= 33 : value >= 67;
  const mid = inverse ? value > 33 && value <= 66 : value >= 34 && value < 67;
  const level: StatusInfo['level'] = good ? 'good' : mid ? 'mid' : 'poor';
  const label: StatusInfo['label'] = good ? 'Good' : mid ? 'Fair' : 'Poor';
  return { level, label };
}

/* ------------------------------------------------------------------ *
 * Coverage helpers.
 * ------------------------------------------------------------------ */
export function coverageStates(ind: Pick<Indicator, 'coverage'>): string[] {
  if (ind.coverage === 'srh8') return SRH_STATES;
  if (ind.coverage === 'sfm') return SFM_STATES;
  if (ind.coverage === 'lcb') return LCB_STATES;
  return ALL_STATES;
}

export function coverageNote(ind: Pick<Indicator, 'coverage' | 'tier'>): string {
  if (ind.coverage === 'srh8')
    return `Available for the 8 SRH priority states only (${SRH_STATES.join(', ')}).`;
  if (ind.coverage === 'sfm')
    return `Available for SFM survey states only (${SFM_STATES.join(', ')}).`;
  if (ind.coverage === 'lcb')
    return `Available for the 8 Lake Chad Basin border states only (${LCB_STATES.join(', ')}).`;
  if (ind.tier === 2) return `Available for select locations only, not all states - see source for which.`;
  return '';
}

/* ------------------------------------------------------------------ *
 * Real disaggregated scoping (reads the ETL snapshot store; no fabrication).
 * ------------------------------------------------------------------ */

export function looksLikePercent(value: unknown): boolean {
  return /^[+-]?\d+(\.\d+)?%$/.test(String(value).trim());
}

export function scopeLabel(filter: FilterState): string {
  const parts: string[] = [];
  // Tightest active geography leads the chip.
  const geo = filter.facility || filter.ward || filter.lga || filter.state || filter.zone;
  if (geo) parts.push(geo);
  if (filter.donor) parts.push(filter.donor);
  if (filter.facilityType) parts.push(filter.facilityType);
  const period = [filter.month, filter.year].filter(Boolean).join(' ');
  if (period) parts.push(period);
  return parts.join(' · ');
}

/** Filters the indicator/KPI cards can be scoped by (all compound with AND). */
function cardScopeActive(filter: FilterState): boolean {
  return !!(
    filter.facility ||
    filter.lga ||
    filter.state ||
    filter.zone ||
    filter.donor ||
    filter.facilityType ||
    filter.year ||
    filter.month
  );
}

export interface EffectiveValue {
  value?: string;
  pct?: number;
  n?: number;
  smallN?: boolean;
  outOfScope: boolean;
}

/**
 * The scoped value for an indicator card under the active filter, or null when no
 * card-level scope is active (→ show the national value). When a scope IS active
 * but the snapshot has no measurement for it, returns `{ outOfScope: true }`.
 */
export function effectiveIndicatorValue(ind: Indicator, filter: FilterState): EffectiveValue | null {
  if (ind.pct <= 0) return null; // national is already a data gap
  if (!cardScopeActive(filter)) return null; // no scope → use the card's national value

  // Compound scope: ONE figure over the intersection of every active filter,
  // computed by re-running the shared indicator engine on the AND-filtered facts.
  const scoped = scopedMeasurements(filter);
  if (!scoped) return null; // facts not loaded yet → fall back to the national value
  const m = scoped[ind.name];
  if (!m) return { outOfScope: true };
  return {
    value: m.value,
    pct: m.pct,
    n: m.n,
    smallN: m.n != null && m.n < SMALL_N,
    outOfScope: false,
  };
}

export interface EffectiveSplit4 extends Split4 {
  outOfScope: boolean;
}

/**
 * Facility functional-status split, scoped to the active geography/type/donor.
 * Per the indicator workbook, MAMII is the sole source, so the split is re-tallied
 * from the AND-filtered MAMII facts (L2/L1/Partial from MAMII, Non-functional
 * derived). Returns null when no geo scope is active (→ the card shows its national
 * split), or an out-of-scope marker when the scope selects no MAMII rows.
 */
export function effectiveSplit4(ind: Indicator, filter: FilterState): EffectiveSplit4 | null {
  if (!ind.split4) return null;
  return functionalStatusScopedSplit(filter);
}

/* ------------------------------------------------------------------ *
 * KPI scoping. Each KPI card carries the `indicator` it summarises, so under an
 * active filter the strip rescopes through the SAME compound engine the cards use
 * (no fabrication — a scope with no data shows "—").
 * ------------------------------------------------------------------ */
export interface ScopedKpi {
  value: string;
  pct: number;
  scoped: boolean;
}

export function scopedKpiValue(
  card: Pick<KpiCard, 'value' | 'pct' | 'label' | 'indicator'>,
  filter: FilterState
): ScopedKpi {
  const national: ScopedKpi = { value: card.value, pct: card.pct, scoped: false };
  if (!card.indicator || !cardScopeActive(filter)) return national;
  const scoped = scopedMeasurements(filter);
  if (!scoped) return national; // facts not loaded yet
  const m = scoped[card.indicator];
  if (!m) return { value: '—', pct: 0, scoped: true }; // no data for this scope
  return { value: m.value, pct: m.pct, scoped: true };
}

/**
 * A copy of an indicators-by-name map with each indicator's pct/value rescoped to
 * the active filter (out-of-scope siblings become an explicit gap: pct 0, "—").
 * Lets cross-indicator charts (ANC1→ANC4 funnel, cause-share donuts, pipeline)
 * stay internally consistent when the card is scoped, instead of mixing a scoped
 * headline with national context slices.
 */
export function scopedSiblings(
  national: Record<string, Indicator>,
  filter: FilterState
): Record<string, Indicator> {
  if (!cardScopeActive(filter)) return national;
  const scoped = scopedMeasurements(filter);
  if (!scoped) return national;
  const out: Record<string, Indicator> = {};
  for (const [name, ind] of Object.entries(national)) {
    const m = scoped[name];
    out[name] = m ? { ...ind, pct: m.pct, value: m.value } : { ...ind, pct: 0, value: '—' };
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Trend granularity transforms (roll native monthly series up to quarter/year).
 * ------------------------------------------------------------------ */
export function monthlyToQuarterly(
  mArr: (number | null)[],
  agg: 'sum' | 'mean' = 'mean'
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let q = 0; q < 14; q++) {
    const chunk = mArr.slice(q * 3, q * 3 + 3).filter((v): v is number => typeof v === 'number' && isFinite(v));
    if (!chunk.length) {
      out.push(null);
      continue;
    }
    const total = chunk.reduce((a, b) => a + b, 0);
    out.push(+(agg === 'sum' ? total : total / chunk.length).toFixed(2));
  }
  return out;
}

export function monthlyToYearly(
  mArr: (number | null)[],
  agg: 'sum' | 'mean' = 'mean'
): (number | null)[] {
  const groups = [mArr.slice(0, 12), mArr.slice(12, 24), mArr.slice(24, 36), mArr.slice(36, 42)];
  return groups.map((g) => {
    const f = g.filter((v): v is number => typeof v === 'number' && isFinite(v));
    if (!f.length) return null;
    const total = f.reduce((a, b) => a + b, 0);
    return +(agg === 'sum' ? total : total / f.length).toFixed(2);
  });
}

/* ------------------------------------------------------------------ *
 * Administrative hierarchy helpers (real reference data).
 * ------------------------------------------------------------------ */
/** Real LGAs for a state (see geo/lgas.ts). Falls back to the state name. */
export function lgasForState(state: string): string[] {
  return LGAS_BY_STATE[state] ?? [state];
}

export const quarterLabels: string[] = (() => {
  const out: string[] = [];
  let yr = 2023;
  let qt = 1;
  for (let i = 0; i < 14; i++) {
    out.push(yr + ' Q' + qt);
    qt++;
    if (qt > 4) {
      qt = 1;
      yr++;
    }
  }
  return out;
})();

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabels: string[] = (() => {
  const out: string[] = [];
  let yr = 2023;
  let mo = 0;
  for (let i = 0; i < 42; i++) {
    out.push(monthNames[mo] + ' ' + yr);
    mo++;
    if (mo > 11) {
      mo = 0;
      yr++;
    }
  }
  return out;
})();

export const yearLabels = ['2023', '2024', '2025', '2026 (YTD)'];
