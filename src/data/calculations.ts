/**
 * Preserved calculation engine.
 *
 * Every function here is ported VERBATIM (math-identical) from the original
 * dashboard so that figures, colours, breakdowns and trend transforms match
 * exactly. The only change is that filter-aware helpers now take an explicit
 * `FilterState` argument instead of reading a module-global, which keeps them
 * pure and testable.
 *
 * When real data is wired in, these same functions run unchanged — they operate
 * on the indicator `pct`/`value` fields regardless of origin.
 */

import type { FilterState, Indicator, BreakdownRow, Split4, Split4Row } from './types';
import { ALL_STATES, STATE_DONORS, ZONE_OF_STATE } from './geo/states';
import { SRH_STATES, SFM_STATES, LCB_STATES } from './mock/indicators';

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random core (seeded by string hash).
 * Identical output to the original ensures the same "mock" figures.
 * ------------------------------------------------------------------ */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function pseudo(seedStr: string): number {
  const h = hashStr(seedStr);
  return (h % 1000) / 1000;
}

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

export function pctChangeFor(seed: string): number {
  const p = pseudo(seed + '|chg');
  return +((p - 0.5) * 30).toFixed(1); // -15..+15
}

/* ------------------------------------------------------------------ *
 * State / facility breakdowns (deep-dive distributions).
 * ------------------------------------------------------------------ */
export function stateBreakdown(
  baseVal: number,
  statesList?: string[],
  inverse?: boolean
): BreakdownRow[] {
  const list = statesList || ALL_STATES;
  return list
    .map((st) => {
      const p = pseudo(st + '|' + baseVal);
      let v = baseVal + (p - 0.5) * Math.max(18, baseVal * 0.5);
      v = Math.max(2, Math.min(98, v));
      return { label: st, value: +v.toFixed(1), change: pctChangeFor(st + '|' + baseVal) };
    })
    .sort((a, b) => (inverse ? a.value - b.value : b.value - a.value));
}

export const FACILITY_NAME_POOL = [
  'Central PHC',
  'Comprehensive Health Centre',
  'Model PHC',
  'Cottage Hospital Annex',
  'Primary Health Clinic',
  'Ward Health Post',
  'General Hospital Annex',
  'Community Health Post',
];
const LGA_NAME_POOL = ['North', 'South', 'East', 'West', 'Central', 'Metropolitan', 'Rural', 'Urban'];

export function facilityBreakdown(
  baseVal: number,
  statesList?: string[],
  inverse?: boolean
): BreakdownRow[] {
  const list = statesList || ALL_STATES;
  const facilities: BreakdownRow[] = [];
  list.forEach((st) => {
    for (let i = 0; i < 2; i++) {
      const lga = `${st} ${LGA_NAME_POOL[hashStr(st + 'lga' + i) % LGA_NAME_POOL.length]}`;
      const fname = `${FACILITY_NAME_POOL[hashStr(st + i + baseVal) % FACILITY_NAME_POOL.length]}`;
      const p = pseudo(fname + st + '|' + baseVal);
      let v = baseVal + (p - 0.5) * Math.max(24, baseVal * 0.65);
      v = Math.max(2, Math.min(98, v));
      facilities.push({
        label: fname,
        state: st,
        lga,
        value: +v.toFixed(1),
        change: pctChangeFor(fname + st + '|' + baseVal),
      });
    }
  });
  return facilities.sort((a, b) => (inverse ? a.value - b.value : b.value - a.value));
}

export function stateSplit4Breakdown(split: Split4): Split4Row[] {
  return ALL_STATES.map((st) => {
    const jitter = (key: string, base: number) =>
      Math.max(1, Math.min(75, base + (pseudo(st + '|' + key) - 0.5) * 26));
    const l2 = jitter('l2', split.l2);
    const l1 = jitter('l1', split.l1);
    const partial = jitter('partial', split.partial);
    const nonfunc = jitter('nonfunc', split.nonfunc);
    const sum = l2 + l1 + partial + nonfunc;
    return {
      label: st,
      l2: +((l2 / sum) * 100).toFixed(1),
      l1: +((l1 / sum) * 100).toFixed(1),
      partial: +((partial / sum) * 100).toFixed(1),
      nonfunc: +((nonfunc / sum) * 100).toFixed(1),
    };
  }).sort((a, b) => b.l2 + b.l1 - (a.l2 + a.l1));
}

export function linregress(values: number[]): number[] {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const xm = xs.reduce((a, b) => a + b, 0) / n;
  const ym = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xm) * (values[i] - ym);
    den += (xs[i] - xm) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = ym - slope * xm;
  return xs.map((x) => +(slope * x + intercept).toFixed(2));
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
    return `Available for SFM survey states only - illustrative subset shown (${SFM_STATES.join(', ')}); confirm the actual SFM state list.`;
  if (ind.coverage === 'lcb')
    return `Available for the 8 Lake Chad Basin border states only (${LCB_STATES.join(', ')}).`;
  if (ind.tier === 2) return `Available for select locations only, not all states - see source for which.`;
  return '';
}

/* ------------------------------------------------------------------ *
 * Filter-aware scoping (pure: filter passed in explicitly).
 * ------------------------------------------------------------------ */
export function looksLikePercent(value: unknown): boolean {
  return /^[+-]?\d+(\.\d+)?%$/.test(String(value).trim());
}

export function scopedStatesForFilter(ind: Indicator, filter: FilterState): string[] | null {
  const cov = coverageStates(ind);
  let list = cov;
  let any = false;
  if (filter.zone) {
    list = list.filter((st) => ZONE_OF_STATE[st] === filter.zone);
    any = true;
  }
  if (filter.donor) {
    list = list.filter((st) => (STATE_DONORS[st] || []).includes(filter.donor));
    any = true;
  }
  if (!any) return null;
  return list;
}

export function scopeLabel(filter: FilterState): string {
  if (filter.state) return filter.state;
  const parts: string[] = [];
  if (filter.zone) parts.push(filter.zone);
  if (filter.donor) parts.push(filter.donor);
  return parts.join(' · ');
}

export interface EffectiveValue {
  value?: string;
  pct?: number;
  outOfScope: boolean;
}

/** Returns null when no location filter is active (use the card's national value). */
export function effectiveIndicatorValue(
  ind: Indicator,
  filter: FilterState
): EffectiveValue | null {
  if (ind.pct <= 0) return null;
  const cov = coverageStates(ind);
  if (filter.state) {
    if (!cov.includes(filter.state)) return { outOfScope: true };
    const p = pseudo(filter.state + '|' + ind.pct);
    let v = ind.pct + (p - 0.5) * Math.max(18, ind.pct * 0.5);
    v = +Math.max(2, Math.min(98, v)).toFixed(1);
    return { value: v + '%', pct: v, outOfScope: false };
  }
  const states = scopedStatesForFilter(ind, filter);
  if (states === null) return null;
  if (states.length === 0) return { outOfScope: true };
  let sum = 0;
  states.forEach((st) => {
    const p = pseudo(st + '|' + ind.pct);
    sum += Math.max(2, Math.min(98, ind.pct + (p - 0.5) * Math.max(18, ind.pct * 0.5)));
  });
  const avg = +(sum / states.length).toFixed(1);
  return { value: avg + '%', pct: avg, outOfScope: false };
}

export interface EffectiveSplit4 extends Split4 {
  outOfScope: boolean;
}

/** Returns null when no location filter is active. */
export function effectiveSplit4(ind: Indicator, filter: FilterState): EffectiveSplit4 | null {
  if (!filter.state && !filter.zone && !filter.donor) return null;
  if (!ind.split4) return null;
  let states = ALL_STATES;
  if (filter.zone) states = states.filter((st) => ZONE_OF_STATE[st] === filter.zone);
  if (filter.donor) states = states.filter((st) => (STATE_DONORS[st] || []).includes(filter.donor));
  if (filter.state) states = states.filter((st) => st === filter.state);
  if (!states.length) return { l2: 0, l1: 0, partial: 0, nonfunc: 0, outOfScope: true };
  const rows = stateSplit4Breakdown(ind.split4).filter((r) => states.includes(r.label));
  const n = rows.length || 1;
  const avg = { l2: 0, l1: 0, partial: 0, nonfunc: 0 };
  rows.forEach((r) => {
    avg.l2 += r.l2;
    avg.l1 += r.l1;
    avg.partial += r.partial;
    avg.nonfunc += r.nonfunc;
  });
  (Object.keys(avg) as (keyof Split4)[]).forEach((k) => {
    avg[k] = +(avg[k] / n).toFixed(1);
  });
  return { ...avg, outOfScope: false };
}

/* ------------------------------------------------------------------ *
 * KPI scoping.
 * ------------------------------------------------------------------ */
export function scaleValueString(str: string, factor: number): string {
  return str.replace(/[\d][\d,.]*/, (m) => {
    const decimals = (m.split('.')[1] || '').length;
    const num = parseFloat(m.replace(/,/g, ''));
    if (isNaN(num)) return m;
    const scaled = Math.max(0, num * factor);
    return scaled.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  });
}

export interface ScopedKpi {
  value: string;
  pct: number;
  scoped: boolean;
}

export function scopedKpiValue(
  k: { value: string; pct: number; label: string },
  filter: FilterState
): ScopedKpi {
  if (!filter.state && !filter.zone && !filter.donor)
    return { value: k.value, pct: k.pct, scoped: false };
  let states = ALL_STATES;
  if (filter.zone) states = states.filter((st) => ZONE_OF_STATE[st] === filter.zone);
  if (filter.donor) states = states.filter((st) => (STATE_DONORS[st] || []).includes(filter.donor));
  if (filter.state) states = states.filter((st) => st === filter.state);
  if (!states.length) return { value: k.value, pct: k.pct, scoped: false };
  let sum = 0;
  states.forEach((st) => {
    const p = pseudo(st + '|kpi|' + k.label);
    sum += Math.max(2, Math.min(98, k.pct + (p - 0.5) * Math.max(14, k.pct * 0.4)));
  });
  const avgPct = +(sum / states.length).toFixed(1);
  const factor = k.pct ? avgPct / k.pct : 1;
  return { value: scaleValueString(k.value, factor), pct: avgPct, scoped: true };
}

/* ------------------------------------------------------------------ *
 * Trend granularity transforms.
 * ------------------------------------------------------------------ */
export function quarterlyToMonthly(qArr: number[], seed: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 14; i++) {
    const cur = qArr[i];
    const next = i < 13 ? qArr[i + 1] : qArr[i] + (qArr[i] - qArr[i - 1]);
    for (let m = 0; m < 3; m++) {
      const t = m / 3;
      const v = cur + (next - cur) * t;
      const jitter =
        (pseudo(seed + '|' + i + '|' + m) - 0.5) * Math.abs(next - cur || cur * 0.04 || 1) * 0.5;
      out.push(+(v + jitter).toFixed(2));
    }
  }
  return out;
}

export function quarterlyToYearly(qArr: number[]): number[] {
  const groups = [qArr.slice(0, 4), qArr.slice(4, 8), qArr.slice(8, 12), qArr.slice(12, 14)];
  return groups.map((g) => +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(2));
}

/* ------------------------------------------------------------------ *
 * Administrative hierarchy helpers + facility dataset builder.
 * ------------------------------------------------------------------ */
const LGA_DIRECTIONS = ['North', 'South', 'East', 'West', 'Central', 'Metropolitan', 'Rural', 'Urban'];
const WARD_NUMS = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];

export function lgasForState(state: string): string[] {
  return LGA_DIRECTIONS.slice(0, 4).map((d) => `${state} ${d}`);
}

export function wardsForLga(lga: string): string[] {
  return WARD_NUMS.slice(0, 4).map((w) => `${lga} - ${w}`);
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
