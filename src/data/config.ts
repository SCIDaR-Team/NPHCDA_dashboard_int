import type { FacilityColumn } from './types';

/**
 * Static UI configuration (not data). Column layout for the Facility Deepdive
 * matrix and the colour/default set for the Trend page. These describe how real
 * data is presented; they carry no illustrative figures.
 */

/**
 * Columns available in the Facility Deepdive assessed matrix. `always` columns
 * can't be hidden. Columns carrying an `indicator` are filled at render time from
 * the shared per-facility engine (`facilityMeasures`) — same figures as the
 * Indicator modal's facility breakdown, rendered "No data" where a facility's
 * source doesn't measure it. All non-`always` columns are opt-in toggle pills.
 */
export const FD_COLUMNS: FacilityColumn[] = [
  { key: 'type', label: 'Type', always: true },
  { key: 'status', label: 'Functional Status', always: true },
  { key: 'tracer', label: 'Commodities available (#)', always: false, group: 'Stock & commodities' },
  {
    key: 'deliveries',
    label: 'Facility deliveries',
    always: false,
    indicator: 'Number of deliveries in facilities',
    fmt: 'count',
    group: 'Service delivery',
  },
  {
    key: 'sbaAttended',
    label: 'SBA-attended deliveries %',
    always: false,
    indicator: 'Proportion of deliveries attended by a skilled birth attendant',
    fmt: 'pct',
    group: 'Service delivery',
  },
  {
    key: 'anc1',
    label: 'ANC1 coverage %',
    always: false,
    indicator: '% of women with a live birth who attended ANC 1',
    fmt: 'pct',
    group: 'Service delivery',
  },
  {
    key: 'fp',
    label: 'Modern contraceptive use %',
    always: false,
    indicator: '% of family planning clients using modern contraceptives',
    fmt: 'pct',
    group: 'Service delivery',
  },
  {
    key: 'pphBundle',
    label: 'PPH bundle',
    always: false,
    indicator: 'Proportion of facilities with the PPH bundle available*',
    fmt: 'bool',
    group: 'Stock & commodities',
  },
  {
    key: 'coldChain',
    label: 'Cold chain (SDD/CCE)',
    always: false,
    indicator: 'Proportion of wards / main PHCs with functional cold-chain equipment (SDD/CCE)',
    fmt: 'bool',
    group: 'Stock & commodities',
  },
  {
    key: 'bhcpf',
    label: 'BHCPF funds received',
    always: false,
    indicator: 'Total BHCPF funds received vs. expected',
    fmt: 'naira',
    group: 'Financing',
  },
  { key: 'satisfaction', label: 'Patient Satisfaction %', always: false, group: 'No source yet' },
];

/** Display order for the assessed-matrix column toggle-pill groups (organisational only). */
export const FD_COLUMN_GROUPS = ['Service delivery', 'Stock & commodities', 'Financing', 'No source yet'];

/**
 * Trend-series checkbox groups — organisational only, keyed by the exact series
 * names `buildTrends` emits. Any live series not listed here falls into an "Other"
 * bucket at render time, so a new snapshot series never disappears from the picker.
 */
export const TREND_GROUPS: { label: string; series: string[] }[] = [
  {
    label: 'Maternal & newborn volume',
    series: [
      'Facility deliveries (count)',
      'Live births (count)',
      'SBA-attended deliveries (%)',
      'ANC1 coverage (%)',
      'ANC4 coverage (%)',
    ],
  },
  { label: 'Family planning', series: ['Modern contraceptive use (%)'] },
  { label: 'Immunization', series: ['Penta 3 completion (%)'] },
  {
    label: 'Mortality (lower is better)',
    series: ['Maternal mortality ratio (per 100k)', 'Under-5 mortality (per 1k)'],
  },
  { label: 'Commodities', series: ['PPH bundle availability (%)'] },
];

/** Facility-matrix columns with no real source yet — rendered as "No data". */
export const FD_NO_DATA_COLUMNS = new Set(['satisfaction']);

/**
 * Trend series colours (cycled across whichever real series the snapshot emits).
 * Leads with the brand green (CHART_GREEN) so the first/primary series always
 * reads green, then the fixed secondary palette (CHART_SECONDARY) — kept in sync
 * with src/components/charts/palette.ts.
 */
export const trendColors: string[] = [
  '#00A859', '#3D7BB5', '#C9A227', '#7A4FA8', '#C2562C', '#5B7089', '#2A9D8F', '#6FC69B', '#8a6d12',
];

/** Series switched on by default when the Trend page first loads (by name match). */
export const defaultsOn = [
  'Facility deliveries (count)',
  'ANC1 coverage (%)',
  'Modern contraceptive use (%)',
];
