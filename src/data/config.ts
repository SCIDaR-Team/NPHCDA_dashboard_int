import type { FacilityColumn } from './types';

/**
 * Static UI configuration (not data). Column layout for the Facility Deepdive
 * matrix and the colour/default set for the Trend page. These describe how real
 * data is presented; they carry no illustrative figures.
 */

/** Columns available in the Facility Deepdive matrix. `always` columns can't be hidden. */
export const FD_COLUMNS: FacilityColumn[] = [
  { key: 'type', label: 'Type', always: true },
  { key: 'status', label: 'Functional Status', always: true },
  { key: 'tracer', label: 'Commodities available (#)', always: false },
  { key: 'maternalDeaths', label: 'Maternal Deaths', always: false },
  { key: 'satisfaction', label: 'Patient Satisfaction %', always: false },
  { key: 'penta3', label: 'Penta 3 %', always: false },
];

/** Facility-matrix columns with no real source yet — rendered as "No data". */
export const FD_NO_DATA_COLUMNS = new Set(['satisfaction', 'penta3']);

/** Trend series colours (cycled across whichever real series the snapshot emits). */
export const trendColors: string[] = [
  '#38BDF8', '#1B5E3A', '#2E8B57', '#C9A227', '#6FA888', '#8a6d12', '#C2562C', '#3D7BB5', '#7A4FA8',
];

/** Series switched on by default when the Trend page first loads (by name match). */
export const defaultsOn = [
  'Facility deliveries (count)',
  'ANC1 coverage (%)',
  'Modern contraceptive use (%)',
];
