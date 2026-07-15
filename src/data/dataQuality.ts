/**
 * Data-quality analytics — computed from the SAME real distributions the rest of the
 * app uses, so the quality view never disagrees with what the cards show.
 *
 *  • Completeness — how many of an indicator's expected states carry a measurement.
 *  • Missing data — indicators with no live source at all (intentional gaps).
 *  • Small samples — measured states below the SMALL_N reliability threshold.
 *  • Outliers — states whose value falls outside the 1.5×IQR fence for the indicator.
 *
 * Timeliness is read separately off getSnapshotMeta() (per-source freshness/status).
 */
import type { Blocks, BlockName } from './types';
import { coverageStates, stateMeasures, SMALL_N } from './calculations';

/** Quartile of a SORTED numeric array (linear interpolation). */
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

/** Indices/labels whose value is outside the Tukey 1.5×IQR fence. Needs ≥4 points
 *  (below that an IQR fence isn't meaningful) → returns an empty list. */
export function outliers<T>(items: T[], valueOf: (t: T) => number): { item: T; value: number; bound: 'low' | 'high' }[] {
  if (items.length < 4) return [];
  const vals = items.map(valueOf).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (vals.length < 4) return [];
  const q1 = quantile(vals, 0.25);
  const q3 = quantile(vals, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return [];
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const out: { item: T; value: number; bound: 'low' | 'high' }[] = [];
  for (const item of items) {
    const v = valueOf(item);
    if (!Number.isFinite(v)) continue;
    if (v < lo) out.push({ item, value: v, bound: 'low' });
    else if (v > hi) out.push({ item, value: v, bound: 'high' });
  }
  return out;
}

export interface IndicatorQuality {
  name: string;
  block: BlockName;
  tier: number;
  /** True when the indicator has a live source (a national or per-state measurement). */
  hasSource: boolean;
  measuredStates: number;
  expectedStates: number;
  /** measuredStates / expectedStates as a 0–100 %, or null when nothing is expected. */
  completeness: number | null;
  /** Measured states below SMALL_N. */
  smallNStates: number;
  /** States flagged as statistical outliers for this indicator. */
  outlierStates: { state: string; value: number; bound: 'low' | 'high' }[];
}

/** Per-indicator data-quality profile across all blocks. */
export function indicatorQualities(blocks: Blocks): IndicatorQuality[] {
  const out: IndicatorQuality[] = [];
  for (const bn of Object.keys(blocks) as BlockName[]) {
    for (const ind of blocks[bn]) {
      const measures = stateMeasures(ind.name);
      const entries = Object.entries(measures);
      const expected = coverageStates(ind).length;
      const measuredStates = entries.length;
      const smallNStates = entries.filter(([, m]) => m.n != null && m.n < SMALL_N).length;
      const hasSource = ind.pct > 0 || measuredStates > 0;
      const outlierStates = outliers(entries, ([, m]) => m.pct).map((o) => ({
        state: o.item[0],
        value: +o.value.toFixed(1),
        bound: o.bound,
      }));
      out.push({
        name: ind.name,
        block: bn,
        tier: ind.tier,
        hasSource,
        measuredStates,
        expectedStates: expected,
        completeness: expected ? +((measuredStates / expected) * 100).toFixed(1) : null,
        smallNStates,
        outlierStates,
      });
    }
  }
  return out;
}

export interface QualitySummary {
  totalIndicators: number;
  withSource: number;
  missing: number;
  meanCompleteness: number | null;
  smallNFlags: number;
  outlierFlags: number;
}

/** Roll the per-indicator profiles into headline data-quality KPIs. */
export function qualitySummary(rows: IndicatorQuality[]): QualitySummary {
  const withSource = rows.filter((r) => r.hasSource);
  const comp = withSource.map((r) => r.completeness).filter((v): v is number => v != null);
  return {
    totalIndicators: rows.length,
    withSource: withSource.length,
    missing: rows.length - withSource.length,
    meanCompleteness: comp.length ? +(comp.reduce((a, b) => a + b, 0) / comp.length).toFixed(1) : null,
    smallNFlags: rows.reduce((a, r) => a + r.smallNStates, 0),
    outlierFlags: rows.reduce((a, r) => a + r.outlierStates.length, 0),
  };
}

