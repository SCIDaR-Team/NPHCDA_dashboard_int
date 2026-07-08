/**
 * Runtime COMPOUND-scope engine.
 *
 * The whole point: every active filter (zone / state / lga / facilityType /
 * facility / donor / year / month) combines with AND into ONE real figure scoped
 * to the intersection — e.g. Enugu + June 2026 is computed over records that are
 * in Enugu AND June 2026, not a "most-specific single dimension" pick.
 *
 * It does this WITHOUT re-implementing any indicator math in the UI: it re-runs
 * the SAME `buildIndicators()` the ETL uses (etl/lib/indicators.mjs) over the
 * AND-filtered subset of the compact `facts` table the snapshot ships. A scope
 * with no matching records simply omits the indicator → the card shows "No data".
 * Every measurement carries `n`, so small samples are flagged (see SMALL_N).
 *
 * The same engine also powers the per-state / per-facility distributions the deep
 * dive and overview map read (stateMeasures / facilityMeasures), so those stay in
 * lockstep with the compound values by construction.
 */
import { buildIndicators, mamiiFunctionalSplit, type EngineRecord, type EngineBundle } from '../../etl/lib/indicators.mjs';
import { buildTrends } from '../../etl/lib/trends.mjs';
import type { FilterState, Split4, TrendSeries } from './types';
import { useSnapshotStore } from '@/store/snapshotStore';

/** A single scoped measurement (carries `n` so the UI can flag small samples). */
export interface ScopedMeasure {
  pct: number;
  value: string;
  n?: number;
  meta?: string;
  /** Real numeric magnitude for ranking/bar length when the display string isn't a
   *  plain number (e.g. a category label). Optional; parsed from `value` otherwise. */
  num?: number;
}

/** The compact per-source fact table the ETL emits (slim records + normalised type). */
export interface SnapshotFacts {
  srh: EngineRecord[];
  sfm: EngineRecord[];
  sheet: EngineRecord[];
  /** MAMII facility rows (state/LGA-native columns denormalised per facility). No
   *  reporting month, so a period filter naturally excludes them (like `sheet`). */
  mamii?: EngineRecord[];
  /** PFMO rows — one per facility-month (has a reporting month, so it scopes by
   *  period like the ODK sources). Type is null (no BEmONC/CEmONC in PFMO). */
  pfmo?: EngineRecord[];
}

/* ------------------------------------------------------------------ *
 * Record → bundle helpers (mirror the ETL adapters exactly).
 * ------------------------------------------------------------------ */

/** Reduce to the most recent submission per facility (state|lga|facility key),
 *  identical to the adapters' latestPerFacility so scoped point-in-time values
 *  match the national one. */
function latestPerFacility(rows: EngineRecord[]): EngineRecord[] {
  const byKey = new Map<string, EngineRecord>();
  for (const r of rows) {
    if (!r.state) continue;
    const key = `${r.state}|${r.lga}|${r.facility}`;
    const prev = byKey.get(key);
    if (!prev || String(r.submittedAt) > String(prev.submittedAt)) byKey.set(key, r);
  }
  return [...byKey.values()];
}

const MONTH_FULL: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};
/** Parse a "Jun 2026"-style month label → { yr, full } or null. */
function parsePeriod(month: unknown): { yr: string; full: string } | null {
  if (!month) return null;
  const [mon, yr] = String(month).split(' ');
  const full = MONTH_FULL[mon];
  return full && yr ? { yr, full } : null;
}

type Predicate = (r: EngineRecord) => boolean;

/** The AND-of-all-active-filters predicate. `ward`/`search` are not scope dims. */
function makePredicate(f: FilterState): { match: Predicate; periodActive: boolean } {
  const periodActive = !!(f.year || f.month);
  const match: Predicate = (r) => {
    if (f.state && r.state !== f.state) return false;
    if (f.zone && r.zone !== f.zone) return false;
    if (f.lga && r.lga !== f.lga) return false;
    if (f.facility && r.facility !== f.facility) return false;
    if (f.facilityType && r.type !== f.facilityType) return false;
    if (f.donor && !(r.donor || []).includes(f.donor)) return false;
    if (periodActive) {
      const p = parsePeriod(r.month);
      if (!p) return false; // no reporting period (e.g. Sheet baseline) → excluded when a period is selected
      if (f.year && p.yr !== f.year) return false;
      if (f.month && p.full !== f.month) return false;
    }
    return true;
  };
  return { match, periodActive };
}

/**
 * Build the { records, allRecords } bundle buildIndicators expects for an ODK
 * source over the matched rows. When a period filter is active, a scope is defined
 * over ALL submissions in that period (records = the period slice); otherwise the
 * point-in-time `records` is the latest submission per facility, exactly as the ETL
 * does for geography scopes.
 */
function odkBundle(all: EngineRecord[], match: Predicate, periodActive: boolean): EngineBundle {
  const allRecords = all.filter(match);
  const records = periodActive ? allRecords : latestPerFacility(allRecords);
  return { records, allRecords };
}

/**
 * Run the shared engine over the AND-filtered facts. The Sheet is a one-time
 * baseline with no reporting period, so its rows carry no month and are naturally
 * excluded whenever a period filter is active.
 */
function runEngine(facts: SnapshotFacts, match: Predicate, periodActive: boolean): Record<string, ScopedMeasure> {
  const sheet = facts.sheet.filter(match);
  // MAMII rows carry no reporting month, so `match` already drops them all when a
  // period filter is active — same behaviour as the Sheet baseline.
  const mamii = (facts.mamii ?? []).filter(match);
  return buildIndicators(
    odkBundle(facts.srh, match, periodActive),
    odkBundle(facts.sfm, match, periodActive),
    { records: sheet, allRecords: sheet },
    { records: mamii, allRecords: mamii },
    // PFMO facts are one row per facility-month, so it scopes exactly like the ODK
    // sources: latest-per-facility for status, the period slice for summed flows.
    odkBundle(facts.pfmo ?? [], match, periodActive)
  ) as Record<string, ScopedMeasure>;
}

/* ------------------------------------------------------------------ *
 * Compound scoping (memoised — one engine pass per distinct filter).
 * ------------------------------------------------------------------ */
let compoundFacts: SnapshotFacts | null = null;
let compoundKey: string | null = null;
let compoundVal: Record<string, ScopedMeasure> | null = null;

function filterKey(f: FilterState): string {
  return JSON.stringify([f.zone, f.state, f.lga, f.facility, f.facilityType, f.donor, f.year, f.month]);
}

/**
 * All indicator measurements for the active filter, computed over the intersection
 * of every active dimension. Returns null when the facts snapshot has not loaded
 * yet (caller falls back to the national value — no false "out of scope").
 */
export function scopedMeasurements(filter: FilterState): Record<string, ScopedMeasure> | null {
  const facts = useSnapshotStore.getState().facts;
  if (!facts) return null;
  const key = filterKey(filter);
  if (compoundVal && compoundFacts === facts && compoundKey === key) return compoundVal;
  const { match, periodActive } = makePredicate(filter);
  compoundVal = runEngine(facts, match, periodActive);
  compoundFacts = facts;
  compoundKey = key;
  return compoundVal;
}

/* ------------------------------------------------------------------ *
 * Scoped monthly trends (Trend Analysis page under an active filter). Re-runs the
 * SAME shared trend engine (etl/lib/trends.mjs) the ETL used for the national series,
 * over the AND-filtered facts — so a scoped line is the honest recomputation, never a
 * slice of the national one. The period (year/month) part of the filter is IGNORED: a
 * trend spans time, so only geography / facility-type / donor scope it.
 * ------------------------------------------------------------------ */
let trendFacts: SnapshotFacts | null = null;
let trendKey: string | null = null;
let trendVal: TrendSeries | null = null;

export function scopedTrends(filter: FilterState): TrendSeries | null {
  const facts = useSnapshotStore.getState().facts;
  if (!facts) return null;
  // Trends ignore the period (year/month) part of the filter, so the memo key is the
  // geography / facility-type / donor scope only — one engine pass per distinct scope,
  // reused across the many cards that ask for it on a page.
  const key = JSON.stringify([filter.zone, filter.state, filter.lga, filter.facility, filter.facilityType, filter.donor]);
  if (trendVal && trendFacts === facts && trendKey === key) return trendVal;
  const { match } = makePredicate({ ...filter, year: '', month: '' });
  trendVal = buildTrends(
    facts.srh.filter(match),
    facts.sfm.filter(match),
    (facts.pfmo ?? []).filter(match),
  ) as TrendSeries;
  trendFacts = facts;
  trendKey = key;
  return trendVal;
}

/* ------------------------------------------------------------------ *
 * Single-dimension distributions (deep-dive chart / overview map). Derived from
 * the SAME engine so they never diverge from the compound values. Computed once
 * per facts load and memoised: each key runs the engine over just that key's rows,
 * so the total work is ~one pass over all records.
 * ------------------------------------------------------------------ */
/**
 * One distribution across a single dimension (per state or per facility), built by
 * bucketing every source's rows by key ONCE (O(N)) and running the shared engine once
 * per bucket — instead of re-scanning ALL records for every distinct key, which was
 * O(keys × N). With PFMO's ~54k facility-months spread over ~36k facility keys that was
 * billions of filter passes on the main thread and froze the tab ("Page Unresponsive").
 *
 * `excludePfmo` drops PFMO from a distribution whose grain PFMO can't honestly fill:
 * PFMO rows are one-per-facility-month, so a per-FACILITY MMR/Penta3/etc. is a single
 * noisy month, and there are ~36k of them — neither a meaningful ranking nor a
 * renderable table. PFMO's honest disaggregation is per-STATE (kept by stateMeasures);
 * the national and per-state figures are unaffected either way.
 */
function computeDim(
  facts: SnapshotFacts,
  keysFor: (r: EngineRecord) => string | undefined,
  excludePfmo = false,
): Record<string, Record<string, ScopedMeasure>> {
  const bucketBy = (rows: EngineRecord[]): Map<string, EngineRecord[]> => {
    const m = new Map<string, EngineRecord[]>();
    for (const r of rows) {
      const k = keysFor(r);
      if (!k) continue;
      const a = m.get(k);
      if (a) a.push(r);
      else m.set(k, [r]);
    }
    return m;
  };
  const srh = bucketBy(facts.srh);
  const sfm = bucketBy(facts.sfm);
  const sheet = bucketBy(facts.sheet);
  const mamii = bucketBy(facts.mamii ?? []);
  const pfmo = excludePfmo ? new Map<string, EngineRecord[]>() : bucketBy(facts.pfmo ?? []);
  const keys = new Set<string>([
    ...srh.keys(), ...sfm.keys(), ...sheet.keys(), ...mamii.keys(), ...pfmo.keys(),
  ]);
  const EMPTY: EngineRecord[] = [];
  const out: Record<string, Record<string, ScopedMeasure>> = {};
  for (const key of keys) {
    // Each bucket already holds exactly this key's rows, so a `true` predicate over the
    // per-key slice is identical to the old `keysFor(r) === key` filter over all rows.
    const scoped: SnapshotFacts = {
      srh: srh.get(key) ?? EMPTY,
      sfm: sfm.get(key) ?? EMPTY,
      sheet: sheet.get(key) ?? EMPTY,
      mamii: mamii.get(key) ?? EMPTY,
      pfmo: pfmo.get(key) ?? EMPTY,
    };
    const m = runEngine(scoped, () => true, false);
    for (const [name, meas] of Object.entries(m)) (out[name] ||= {})[key] = meas;
  }
  return out;
}

function memoDim(
  cache: DimCache,
  keysFor: (r: EngineRecord) => string | undefined,
  excludePfmo = false,
): Record<string, Record<string, ScopedMeasure>> {
  const facts = useSnapshotStore.getState().facts;
  if (!facts) return {};
  if (cache.facts !== facts || !cache.val) {
    cache.val = computeDim(facts, keysFor, excludePfmo);
    cache.facts = facts;
  }
  return cache.val;
}

interface DimCache {
  facts: SnapshotFacts | null;
  val: Record<string, Record<string, ScopedMeasure>> | null;
}
const stateCache: DimCache = { facts: null, val: null };
const facilityCache: DimCache = { facts: null, val: null };

/* ------------------------------------------------------------------ *
 * Facility functional status (#30-33) — per the indicator workbook, MAMII is the
 * SOLE source: L2/L1/Partial from MAMII's LGA columns, Non-functional derived. The
 * split is LGA-aggregate (not per-facility), so every breakdown here is computed by
 * de-duping the scoped MAMII facts to one row per LGA (mamiiFunctionalSplit), and
 * there is NO honest facility-level view.
 * ------------------------------------------------------------------ */
export const FUNCTIONAL_STATUS_INDICATOR = 'Facility functional status per state (L1 / L2 / partial / non-functional)';

/** Group the MAMII facts by state (empty when the snapshot hasn't loaded). */
function mamiiByState(): Record<string, EngineRecord[]> {
  const rows = useSnapshotStore.getState().facts?.mamii ?? [];
  const byState: Record<string, EngineRecord[]> = {};
  for (const r of rows) if (r.state) (byState[r.state] ||= []).push(r);
  return byState;
}

/** Per-state L2/L1/partial/non-functional composition (%), ranked by functional
 *  (L1+L2) share — feeds the stacked bar in the functional-status deep-dive. */
export interface StatusSplit {
  state: string;
  l2: number;
  l1: number;
  partial: number;
  nonfunc: number;
  functional: number;
  n: number;
}
export function functionalStatusStateSplits(): StatusSplit[] {
  return Object.entries(mamiiByState())
    .map(([state, rows]) => {
      const s = mamiiFunctionalSplit(rows);
      if (!s) return null;
      return { state, l2: s.l2, l1: s.l1, partial: s.partial, nonfunc: s.nonfunc, functional: s.l2 + s.l1, n: s.total };
    })
    .filter((s): s is StatusSplit => s != null)
    .sort((a, b) => b.functional - a.functional);
}

/** Per-state split of L2/L1/partial/non-functional; pct + bar magnitude = the
 *  functional (L1+L2) share, with the full split spelled out in `value`. */
function functionalStatusByState(): Record<string, ScopedMeasure> {
  const out: Record<string, ScopedMeasure> = {};
  for (const [st, rows] of Object.entries(mamiiByState())) {
    const s = mamiiFunctionalSplit(rows);
    if (!s) continue;
    out[st] = {
      pct: s.l2 + s.l1,
      num: s.l2 + s.l1,
      value: `${Math.round(s.l2 + s.l1)}% functional · L2 ${s.l2}% · L1 ${s.l1}% · Partial ${s.partial}% · Non-func ${s.nonfunc}%`,
      n: s.total,
    };
  }
  return out;
}

/** MAMII carries no per-facility functional status (its L1/L2/partial are LGA
 *  counts), so there is no honest facility-level breakdown. */
function functionalStatusByFacility(): Record<string, ScopedMeasure> {
  return {};
}

/** The functional-status split scoped to the active geography, computed over the
 *  AND-filtered MAMII facts. Returns null when no geo scope is active (→ the card
 *  shows its national split), or an out-of-scope marker when the scope selects no
 *  MAMII rows. MAMII has no reporting period, so year/month never rescope it. */
export function functionalStatusScopedSplit(filter: FilterState): (Split4 & { outOfScope: boolean }) | null {
  const geoActive = !!(filter.state || filter.zone || filter.lga || filter.facility || filter.facilityType || filter.donor);
  if (!geoActive) return null;
  const rows = useSnapshotStore.getState().facts?.mamii ?? [];
  if (!rows.length) return null;
  const { match } = makePredicate({ ...filter, year: '', month: '' });
  const s = mamiiFunctionalSplit(rows.filter(match));
  if (!s) return { l2: 0, l1: 0, partial: 0, nonfunc: 0, outOfScope: true };
  return { l2: s.l2, l1: s.l1, partial: s.partial, nonfunc: s.nonfunc, outOfScope: false };
}

/**
 * MAMII aggregate indicators whose value is DENORMALISED at the state or LGA level
 * (the same figure repeats across every facility row in the group). A per-facility
 * breakdown would misleadingly show the state/LGA total on each facility, so these
 * expose NO facility view — only state (and coarser) disaggregation is honest.
 */
const AGGREGATE_ONLY_INDICATORS = new Set([
  'Proportion of CBHWs recruited',
  'Number of CBHWs trained',
  'Proportion of CBHWs deployed per state',
  '% of recruited CBHWs that have been absorbed',
  'Number of revitalized PHC facilities per state',
]);

/**
 * MAMII workforce/activity indicators where a 0 means "no recruitment/activity here
 * yet", not a real measured level. Their per-state / per-facility distributions
 * therefore OMIT zero rows — the deep-dive lists only the states/facilities that
 * actually have activity, instead of ranking 30 empty "0" bars below the few real
 * ones. (The single-scope CARD still shows 0 for an explicitly selected state.)
 */
export const HIDE_ZERO_DISTRIBUTION_INDICATORS = new Set([
  'Number of SBAs recruited',
  'Proportion of SBAs deployed per state',
  'Proportion of CBHWs recruited',
  'Number of CBHWs trained',
  'Proportion of CBHWs deployed per state',
  '% of recruited CBHWs that have been absorbed',
  'Number of revitalized PHC facilities per state',
]);

/** All real per-state measurements for an indicator (for the deep-dive chart / map). */
export function stateMeasures(indicatorName: string): Record<string, ScopedMeasure> {
  if (indicatorName === FUNCTIONAL_STATUS_INDICATOR) return functionalStatusByState();
  return memoDim(stateCache, (r) => r.state)[indicatorName] ?? {};
}

/**
 * Composite key for the per-facility distribution. MAMII (and some ODK) datasets
 * REUSE the same facility NAME across different states — e.g. "Nasarawa Primary
 * Health Centre" exists in both Bauchi and Kaduna — so keying the distribution by
 * bare name pools unrelated physical facilities (and mislabels the merged row with
 * whichever state happened to appear first). Keying by state|lga|facility keeps each
 * physical facility separate. State/LGA never contain "|", so parsing back is safe.
 */
const facilityKeyOf = (r: EngineRecord): string | undefined =>
  r.facility ? `${r.state ?? ''}|${r.lga ?? ''}|${r.facility}` : undefined;

export function parseFacilityKey(key: string): { state: string; lga: string; facility: string } {
  const [state = '', lga = '', ...rest] = key.split('|');
  return { state, lga, facility: rest.join('|') };
}

/** All real per-facility measurements for an indicator, keyed by state|lga|facility. */
export function facilityMeasures(indicatorName: string): Record<string, ScopedMeasure> {
  if (AGGREGATE_ONLY_INDICATORS.has(indicatorName)) return {}; // no honest facility grain
  if (indicatorName === FUNCTIONAL_STATUS_INDICATOR) return functionalStatusByFacility();
  // Exclude PFMO from the per-facility grain: its one-row-per-facility-month values make
  // a per-facility ranking meaningless, and its ~36k facilities can't render or compute.
  return memoDim(facilityCache, facilityKeyOf, true)[indicatorName] ?? {};
}

/**
 * Facility → {state, lga} index for MAMII facilities, which are NOT in the roster
 * (the roster covers only SRH/SFM/Sheet). Used as a fallback so facility-level
 * deep-dive tables for the MAMII facility-native indicators (SBAs recruited/
 * deployed, ≥4-SBA) can label their MAMII rows with the state/LGA MAMII carries on
 * every row, instead of "—" — without polluting the roster / Facility Deepdive.
 */
let mamiiGeoCache: { facts: SnapshotFacts | null; val: Record<string, { state: string; lga: string }> | null } = {
  facts: null,
  val: null,
};
export function mamiiFacilityGeo(): Record<string, { state: string; lga: string }> {
  const facts = useSnapshotStore.getState().facts;
  if (!facts) return {};
  if (mamiiGeoCache.facts !== facts || !mamiiGeoCache.val) {
    const out: Record<string, { state: string; lga: string }> = {};
    for (const r of facts.mamii ?? []) {
      if (r.facility && !out[r.facility]) out[r.facility] = { state: r.state, lga: r.lga };
    }
    mamiiGeoCache = { facts, val: out };
    return out;
  }
  return mamiiGeoCache.val;
}
