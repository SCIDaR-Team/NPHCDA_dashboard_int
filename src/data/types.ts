/**
 * Domain model for the NPHCDA PHC Readiness, Stock & Service Dashboard.
 *
 * These types describe the *shape of the data the UI consumes* — independent of
 * where the data comes from. The SnapshotDataSource (real ETL data) and a future
 * ApiDataSource both satisfy the `DataSource` interface (see ./datasource), so the
 * UI never depends on a specific source.
 *
 * NOTE: indicator/KPI names, tiers, pct values and `inverse` flags are part of the
 * preserved business logic and must not be altered. See reference/ for the original.
 */

/** Tier 1 = available for all states, Tier 2 = select locations, Tier 3 = not available yet. */
export type Tier = 1 | 2 | 3;

/** Disaggregation levels an indicator can be broken down by. */
export type DisaggLevel = 'national' | 'zonal' | 'state' | 'lga' | 'ward' | 'facility';

/** Special data-coverage subsets some indicators are limited to. */
export type Coverage = 'srh8' | 'sfm' | 'lcb';

/** The three top-level programme areas (building blocks). */
export type BlockName = 'Facility Readiness' | 'Stock Status' | 'Service Delivery';

/** Four-way facility functional-status split (sums to ~100). */
export interface Split4 {
  l2: number;
  l1: number;
  partial: number;
  nonfunc: number;
}

/** A single tracked indicator. */
export interface Indicator {
  name: string;
  tier: Tier;
  /** Display value (may carry units, e.g. "₦2.1bn / ₦2.6bn", "38 : 1"). */
  value: string;
  /** Normalised 0–100 performance value used for colour/sorting. 0 = data gap. */
  pct: number;
  /** One-line rationale shown under the value. */
  meta: string;
  /** Source dashboard(s). */
  src: string;
  /** Disaggregation levels available. */
  disagg: string[];
  /** When true, lower is better (e.g. mortality, stock-out, zero-dose). */
  inverse?: boolean;
  /** Present for the facility functional-status indicator. */
  split4?: Split4;
  /** Restricts the indicator to a coverage subset. */
  coverage?: Coverage;
  /** Key into the DEFINITIONS composite breakdown table. */
  info?: string;
}

export type Blocks = Record<string, Indicator[]>;

/** Sub-section grouping within a block page: [sectionTitle, indicatorNames]. */
export type BlockSection = [string, string[]];
export type BlockSections = Record<string, BlockSection[]>;

/** A KPI card in the Overview strip. */
export interface KpiCard {
  label: string;
  /** Indicator name this card summarises — lets the strip rescope under filters. */
  indicator?: string;
  value: string;
  delta: string;
  dir: 'up' | 'down';
  target: string;
  spark: number[];
  pct: number;
  inverse: boolean;
  /** When set, render a progress ring at this percentage. */
  ring?: number;
  /** Invert the ring colour scale (lower = better). */
  ringInverse?: boolean;
  /** Trend series this card's "over period" delta is derived from — lets the strip
   *  recompute the delta over the filter-scoped series (null for cards with no trend). */
  trendKey?: string;
  /** True when the trend series is a percentage (delta shown in "pts", else "%"). */
  trendIsPct?: boolean;
}

export interface KpiGroup {
  group: string;
  cards: KpiCard[];
}

/** Composite definition (tracer commodities, PPH bundle, etc.). */
export interface CompositeDefinition {
  title: string;
  composite?: number;
  note: string | null;
  items: [string, number][] | null;
  text?: string;
}

/** Per-source fetch status the ETL records in the snapshot header. */
export interface SourceStatus {
  name: string;
  ok: boolean;
  error: string | null;
  rowsFetched: number;
  facilities: number;
}

/** Snapshot provenance/freshness metadata (data lineage + last refresh). */
export interface SnapshotMeta {
  generatedAt: string;
  period: { from: string | null; to: string | null; quarters: string[] };
  sources: SourceStatus[];
}

/** A facility row in the Facility Deepdive matrix. */
export interface FacilityRow {
  state: string;
  /**
   * Derived filter dimensions, stamped by the ETL from the record's state
   * (see etl/lib/states.mjs). Optional so mock rows — which derive them from
   * state via the geo lookups — still satisfy the type.
   */
  zone?: string;
  donor?: string[];
  lga: string;
  ward: string;
  facility: string;
  type: 'CEmONC' | 'BEmONC';
  status: 'L2' | 'L1' | 'Partial' | 'Non-functional';
  tracer: number;
  satisfaction: number;
  penta3: number;
  maternalDeaths: number;
}

export interface FacilityColumn {
  key: string;
  label: string;
  always: boolean;
  /**
   * When set, the column's value is not a plain roster field but a per-facility
   * measurement pulled at runtime from the shared engine (`facilityMeasures`),
   * keyed by this indicator name. No new math — the same figure the Indicator
   * modal's facility breakdown shows.
   */
  indicator?: string;
  /** How an indicator-backed column renders/sorts. Roster fields omit this. */
  fmt?: 'count' | 'pct' | 'naira' | 'bool';
  /** Toggle-pill grouping label (organisational only; see FD_COLUMN_GROUPS). */
  group?: string;
}

/** A breakdown row (state or facility level). */
export interface BreakdownRow {
  label: string;
  value: number;
  change: number;
  state?: string;
  lga?: string;
}

export interface Split4Row {
  label: string;
  l2: number;
  l1: number;
  partial: number;
  nonfunc: number;
}

/**
 * Trend series keyed by series name → 14 quarterly points (2023Q1–2026Q2).
 * A point may be `null` when a quarter has no data (real sources may only cover
 * part of the window) — rendered as a gap, never fabricated.
 */
export type TrendSeries = Record<string, (number | null)[]>;

/** The active filter scope shared across the app. */
export interface FilterState {
  search: string;
  donor: string;
  /** Data-source / programme scope: '' (all), 'SRH', 'SFM', 'MAMII' or 'PFMO'.
   *  Restricts every scoped computation to the selected source's records. */
  source: string;
  zone: string;
  state: string;
  lga: string;
  ward: string;
  facilityType: string;
  facility: string;
  year: string;
  month: string;
}
