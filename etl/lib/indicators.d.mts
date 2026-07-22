/**
 * Type surface for the shared indicator engine (indicators.mjs), so the browser
 * app (src/data/scopedEngine.ts) can import and re-run it under `tsc` cleanly.
 * The records are the flat, source-agnostic shapes the ETL adapters emit; the
 * engine only reads a subset of numeric/boolean fields off them.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EngineRecord = Record<string, any>;

export interface EngineBundle {
  records: EngineRecord[];
  allRecords?: EngineRecord[];
}

export interface EngineMeasurement {
  pct: number;
  value: string;
  n?: number;
  meta?: string;
  info?: string | null;
  count?: number;
  /** Optional secondary figure (e.g. the delivery count behind a proportion), shown
   *  in the deep-dive breakdown. */
  sub?: string;
  /** Raw counts behind a proportion, with labels naming what each counts, so the
   *  deep dive can show the absolute figures alongside the percentage. */
  numerator?: number;
  denominator?: number;
  valueLabel?: string;
  denomLabel?: string;
}

export function buildIndicators(
  srh: EngineBundle,
  sfm: EngineBundle,
  sheet: EngineBundle,
  mamii?: EngineBundle,
  pfmo?: EngineBundle
): Record<string, EngineMeasurement>;

export interface MamiiFunctionalSplit {
  l2: number;
  l1: number;
  partial: number;
  nonfunc: number;
  total: number;
  states: number;
}

/** MAMII 4-way facility functional split over the given (possibly scoped) rows. */
export function mamiiFunctionalSplit(rows: EngineRecord[]): MamiiFunctionalSplit | null;
