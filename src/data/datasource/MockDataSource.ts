import type { DataSource } from './types';
import { kpiGroups } from '../mock/kpis';
import {
  blocks,
  blockSections,
  INDICATOR_DEFS,
  DEFINITIONS,
} from '../mock/indicators';
import { trendSeries } from '../mock/trends';
import { FD_DATA } from '../mock/facilities';
import { STATE_SCORE, STATE_DONORS } from '../geo/states';
import { quarterlyToMonthly } from '../calculations';

/** The app renders trends at native MONTHLY resolution; the mock is authored
 *  quarterly, so expand it to 42 monthly points at the source boundary. */
const monthlyTrendSeries = Object.fromEntries(
  Object.entries(trendSeries).map(([name, q]) => [name, quarterlyToMonthly(q, name)])
);

/**
 * Mock data source — serves the preserved illustrative figures.
 *
 * A small artificial latency makes loading/skeleton states visible and realistic,
 * matching how the future API source will behave. Set `VITE_MOCK_LATENCY_MS=0`
 * to disable.
 */
const LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 350);

function resolve<T>(value: T): Promise<T> {
  if (!LATENCY) return Promise.resolve(value);
  return new Promise((r) => setTimeout(() => r(value), LATENCY));
}

export class MockDataSource implements DataSource {
  readonly meta = { mode: 'mock' as const, label: 'Mock / Illustrative data' };

  getKpiGroups() {
    return resolve(kpiGroups);
  }
  getBlocks() {
    return resolve(blocks);
  }
  getBlockSections() {
    return resolve(blockSections);
  }
  getIndicatorDefs() {
    return resolve(INDICATOR_DEFS);
  }
  getDefinitions() {
    return resolve(DEFINITIONS);
  }
  getTrendSeries() {
    return resolve(monthlyTrendSeries);
  }
  getFacilities() {
    return resolve(FD_DATA);
  }
  getStateScores() {
    return resolve(STATE_SCORE);
  }
  getStateDonors() {
    return resolve(STATE_DONORS);
  }
}
