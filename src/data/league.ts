/**
 * League-table row builder — ranks scopes (states / LGAs / facilities) by a chosen
 * metric, with year-over-year movement where periodic data exists.
 *
 * Reuses the shared distributions (stateMeasures / lgaMeasures / facilityMeasures)
 * and the scorecard engine (for the composite metric), so a league table never
 * re-implements indicator math and always agrees with the scorecard / deep-dive.
 */
import type { Blocks, Indicator } from './types';
import { decodeHtml } from '@/lib/format';
import {
  stateMeasures,
  lgaMeasures,
  facilityMeasures,
  parseFacilityKey,
  parseLgaKey,
  indicatorMovement,
  type Movement,
  type ScopedMeasure,
} from './scopedEngine';
import { scorecardRows, type Grade } from './scorecard';

export type LeagueLevel = 'state' | 'lga' | 'facility';
/** 'composite' ranks by the scorecard overall; otherwise the metric is an indicator name. */
export type LeagueMetric = 'composite' | string;

export interface LeagueRow {
  key: string;
  label: string;
  state?: string;
  lga?: string;
  /** 0–100 goodness used for ranking + colour (inverse-aware). */
  goodness: number;
  /** Formatted value shown in the table. */
  display: string;
  n?: number;
  /** Present only for the composite metric. */
  grade?: Grade | null;
  /** Present only for indicator metrics on state/LGA scopes with ≥2 measured years. */
  movement?: (Movement & { improved: boolean }) | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function goodnessOf(ind: Indicator, pct: number): number {
  return round1(ind.inverse ? 100 - pct : pct);
}

/** Keys (scope identifiers) with data for an indicator at a given grain, optionally
 *  constrained to a parent state (LGA/facility grains). */
function keysForIndicator(measures: Record<string, ScopedMeasure>, level: LeagueLevel, state?: string): string[] {
  const keys = Object.keys(measures);
  if (level === 'state') return keys;
  // LGA keys are `state|lga`, facility keys `state|lga|facility` — both lead with state.
  return state ? keys.filter((k) => k.startsWith(`${state}|`)) : keys;
}

function labelFor(key: string, level: LeagueLevel): { label: string; state?: string; lga?: string } {
  if (level === 'state') return { label: key };
  if (level === 'lga') {
    const { state, lga } = parseLgaKey(key);
    return { label: lga, state };
  }
  const { state, lga, facility } = parseFacilityKey(key);
  return { label: facility, state, lga };
}

/**
 * Ranked league rows for an indicator metric. Rows are sorted best-first by goodness;
 * the caller assigns rank numbers. Movement is attached for state/LGA grains from the
 * shared YoY helper, flagged `improved` in the indicator's own direction (a drop in
 * mortality is an improvement).
 */
function indicatorLeague(ind: Indicator, level: LeagueLevel, state: string | undefined): LeagueRow[] {
  const measures = level === 'lga' ? lgaMeasures(ind.name) : level === 'facility' ? facilityMeasures(ind.name) : stateMeasures(ind.name);
  const move = level === 'facility' ? {} : indicatorMovement(ind.name, level);
  const rows = keysForIndicator(measures, level, state).map((key): LeagueRow => {
    const m = measures[key];
    const { label, state: st, lga } = labelFor(key, level);
    const mv = move[key];
    return {
      key,
      label,
      state: st,
      lga,
      goodness: goodnessOf(ind, m.pct),
      display: decodeHtml(m.value),
      n: m.n,
      movement: mv ? { ...mv, improved: ind.inverse ? mv.delta < 0 : mv.delta > 0 } : null,
    };
  });
  return rows.sort((a, b) => b.goodness - a.goodness || a.label.localeCompare(b.label));
}

/** Ranked league rows for the composite metric (scorecard overall + grade). */
function compositeLeague(blocks: Blocks, level: 'state' | 'lga', keys: string[]): LeagueRow[] {
  return scorecardRows(blocks, level, keys)
    .filter((r) => r.overall != null)
    .map((r): LeagueRow => ({
      key: r.key,
      label: r.label,
      state: r.state,
      goodness: r.overall as number,
      display: `${Math.round(r.overall as number)}/100`,
      n: r.blocksMeasured,
      grade: r.grade,
      movement: null,
    }))
    .sort((a, b) => b.goodness - a.goodness || a.label.localeCompare(b.label));
}

/**
 * Build ranked league rows. For the composite metric, `keys` is the scope set to grade
 * (states, or a state's LGAs); for an indicator metric the scope set is derived from
 * that indicator's own distribution (optionally constrained to `state`).
 */
export function leagueRows(
  blocks: Blocks,
  level: LeagueLevel,
  metric: LeagueMetric,
  opts: { indByName: Record<string, Indicator>; state?: string; keys?: string[] }
): LeagueRow[] {
  if (metric === 'composite') {
    if (level === 'facility') return []; // no facility-level composite (see scorecard engine)
    return compositeLeague(blocks, level, opts.keys ?? []);
  }
  const ind = opts.indByName[metric];
  if (!ind) return [];
  return indicatorLeague(ind, level, opts.state);
}
