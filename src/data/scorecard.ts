/**
 * Scorecard & grading engine — the shared "score a scope" primitive.
 *
 * Generalises the single curated map composite (see components/map/stateProfile.ts)
 * into a block-partitioned instrument: for any scope (National / a State / an LGA) it
 * computes a 0–100 sub-score for each building block (Facility Readiness / Stock Status
 * / Service Delivery), an overall composite (the mean of the available block
 * sub-scores, so each block weighs equally), an A–F grade, and a traffic-light status.
 *
 * REAL-DATA-ONLY discipline: a block sub-score averages ONLY the block's gradeable
 * indicators that have a real measurement for the scope. A scope with no data for a
 * block yields a null sub-score (rendered as "—", never a fabricated 0). Raw count
 * indicators ("Number of …") are excluded because their normalised `pct` is not a
 * comparable 0–100 "goodness"; every other indicator contributes its inverse-aware
 * goodness (mortality/stock-out/etc. already flipped so higher = better).
 *
 * The scoring core (scoreBlock / gradeFor / overallOf) is PURE and injectable, so it
 * is unit-tested without the snapshot store; scorecardRows wires the store-backed
 * per-state / per-LGA distributions (stateMeasures / lgaMeasures) into that core.
 */
import type { Blocks, BlockName, Indicator } from './types';
import { statusFor, type StatusInfo } from './calculations';
import { stateMeasures, lgaMeasures, parseLgaKey } from './scopedEngine';

export const BLOCK_NAMES: BlockName[] = ['Facility Readiness', 'Stock Status', 'Service Delivery'];

/** Short labels for the block sub-scores (the scorecard column headers). */
export const BLOCK_SHORT: Record<BlockName, string> = {
  'Facility Readiness': 'Readiness',
  'Stock Status': 'Stock',
  'Service Delivery': 'Service',
};

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Grade band lower bounds (inclusive), highest first. Aligned with statusFor's
 *  good/fair/poor cut-points: A/B are "good" (≥67), C is "fair", D/F are "poor". */
export const GRADE_BANDS: { grade: Grade; min: number }[] = [
  { grade: 'A', min: 80 },
  { grade: 'B', min: 67 },
  { grade: 'C', min: 50 },
  { grade: 'D', min: 34 },
  { grade: 'F', min: 0 },
];

/** Map a 0–100 composite to a letter grade (null passes through as null). */
export function gradeFor(score: number | null): Grade | null {
  if (score == null || !isFinite(score)) return null;
  for (const band of GRADE_BANDS) if (score >= band.min) return band.grade;
  return 'F';
}

/**
 * Whether an indicator contributes to a block sub-score. Raw counts are excluded
 * (their `pct` is a normalised proxy, not a comparable 0–100 goodness); everything
 * else — proportions, rates, and inverse outcome indicators — is gradeable.
 */
export function isGradeableIndicator(ind: Pick<Indicator, 'name'>): boolean {
  return !/^\s*Number of/i.test(ind.name);
}

/** The gradeable indicators of each block, in catalogue order. */
export function gradeableByBlock(blocks: Blocks): Record<BlockName, Indicator[]> {
  const out = {} as Record<BlockName, Indicator[]>;
  for (const bn of BLOCK_NAMES) out[bn] = (blocks[bn] ?? []).filter(isGradeableIndicator);
  return out;
}

/** One block's sub-score for a scope: the mean goodness of the block's gradeable
 *  indicators that have a real measurement, plus the contributing indicators. */
export interface BlockScore {
  score: number | null;
  /** Number of indicators that contributed a real measurement. */
  n: number;
  /** Per-indicator goodness that fed the mean (for the calculation drawer). */
  contributors: { name: string; goodness: number }[];
}

/**
 * PURE core: average the inverse-aware goodness of a block's indicators, using an
 * injected `goodnessOf(indicator)` that returns the scope's goodness for that
 * indicator or null when it has no measurement. Testable without any store.
 */
export function scoreBlock(
  inds: Indicator[],
  goodnessOf: (ind: Indicator) => number | null
): BlockScore {
  const contributors: { name: string; goodness: number }[] = [];
  for (const ind of inds) {
    const g = goodnessOf(ind);
    if (g == null || !isFinite(g)) continue;
    contributors.push({ name: ind.name, goodness: g });
  }
  if (!contributors.length) return { score: null, n: 0, contributors };
  const sum = contributors.reduce((a, c) => a + c.goodness, 0);
  return { score: +(sum / contributors.length).toFixed(1), n: contributors.length, contributors };
}

/** Overall composite = mean of the available block sub-scores (equal block weight). */
export function overallOf(blockScores: (number | null)[]): number | null {
  const vals = blockScores.filter((v): v is number => v != null && isFinite(v));
  if (!vals.length) return null;
  return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export type ScorecardLevel = 'national' | 'state' | 'lga';

/** A single scorecard row (one scope) with its per-block sub-scores and grade. */
export interface ScorecardRow {
  /** Distribution key: 'National', a state name, or `state|lga`. */
  key: string;
  /** Display label (LGA rows show just the LGA name). */
  label: string;
  level: ScorecardLevel;
  /** Present for LGA rows so they can be grouped/labelled by their parent state. */
  state?: string;
  blocks: Record<BlockName, BlockScore>;
  overall: number | null;
  grade: Grade | null;
  /** Count of blocks with a real sub-score (data breadth signal). */
  blocksMeasured: number;
}

/** Traffic-light status for a 0–100 sub-score/composite (goodness already inverse-
 *  adjusted, so higher is always better here — never pass inverse). */
export function scoreStatus(score: number | null): StatusInfo | null {
  return score == null ? null : statusFor(score, false);
}

/** Build a row from a per-block goodness lookup (shared by national/state/lga). */
function buildRow(
  key: string,
  label: string,
  level: ScorecardLevel,
  byBlock: Record<BlockName, Indicator[]>,
  goodnessOf: (ind: Indicator) => number | null,
  state?: string
): ScorecardRow {
  const blocks = {} as Record<BlockName, BlockScore>;
  for (const bn of BLOCK_NAMES) blocks[bn] = scoreBlock(byBlock[bn], goodnessOf);
  const overall = overallOf(BLOCK_NAMES.map((bn) => blocks[bn].score));
  const blocksMeasured = BLOCK_NAMES.filter((bn) => blocks[bn].score != null).length;
  return { key, label, level, state, blocks, overall, grade: gradeFor(overall), blocksMeasured };
}

/** Inverse-aware goodness from a raw `pct` for an indicator (0 = data gap → null). */
function goodnessFromPct(ind: Indicator, pct: number | undefined): number | null {
  if (pct == null || pct <= 0) return null;
  return ind.inverse ? 100 - pct : pct;
}

/**
 * The National scorecard row — computed from each indicator's own national `pct`
 * (the same figure its card shows), so the national grade agrees with the cards.
 */
export function nationalScorecardRow(blocks: Blocks): ScorecardRow {
  const byBlock = gradeableByBlock(blocks);
  return buildRow('National', 'National', 'national', byBlock, (ind) =>
    goodnessFromPct(ind, ind.pct)
  );
}

/**
 * Per-state (or per-LGA) scorecard rows for the given scope keys, reading the shared
 * per-state / per-LGA distributions so the grades stay in lockstep with the map and
 * deep-dive by construction. Measures for each indicator are fetched once and reused
 * across every key. Rows are returned unsorted (the page sorts/filters).
 */
export function scorecardRows(blocks: Blocks, level: 'state' | 'lga', keys: string[]): ScorecardRow[] {
  const byBlock = gradeableByBlock(blocks);
  const getM = level === 'lga' ? lgaMeasures : stateMeasures;

  // One distribution fetch per gradeable indicator (memoised in the engine anyway).
  const measures = new Map<string, Record<string, { pct: number }>>();
  for (const bn of BLOCK_NAMES) for (const ind of byBlock[bn]) {
    if (!measures.has(ind.name)) measures.set(ind.name, getM(ind.name));
  }

  return keys.map((key) => {
    const label = level === 'lga' ? parseLgaKey(key).lga : key;
    const state = level === 'lga' ? parseLgaKey(key).state : undefined;
    return buildRow(key, label, level, byBlock, (ind) => {
      const m = measures.get(ind.name)?.[key];
      return goodnessFromPct(ind, m?.pct);
    }, state);
  });
}
