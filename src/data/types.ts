/**
 * Domain model for the NPHCDA PHC Readiness, Stock & Service Dashboard.
 *
 * These types describe the *shape of the data the UI consumes* — independent of
 * where the data comes from. The MockDataSource and a future ApiDataSource both
 * satisfy the `DataSource` interface (see ./datasource), so wiring in real data
 * never requires touching the UI.
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

/** A facility row in the Facility Deepdive matrix. */
export interface FacilityRow {
  state: string;
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

/** Trend series keyed by series name → 14 quarterly points (2023Q1–2026Q2). */
export type TrendSeries = Record<string, number[]>;

/** The active filter scope shared across the app. */
export interface FilterState {
  search: string;
  donor: string;
  zone: string;
  state: string;
  lga: string;
  ward: string;
  facility: string;
  period: string;
}
