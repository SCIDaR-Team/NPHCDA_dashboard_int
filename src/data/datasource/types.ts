import type {
  Blocks,
  BlockSections,
  CompositeDefinition,
  FacilityRow,
  KpiGroup,
  TrendSeries,
} from '../types';

/**
 * The contract every data source must satisfy.
 *
 * The entire UI depends ONLY on this interface — never on the mock constants
 * directly. To go live, implement `ApiDataSource` against your backend and flip
 * `VITE_DATA_SOURCE=api`. No UI/component changes required.
 *
 * All methods are async so the same components handle mock (instant) and network
 * (latency, loading, error) data identically.
 */
export interface DataSource {
  /** Human-facing description of where data is coming from. */
  readonly meta: { mode: 'mock' | 'api'; label: string };

  getKpiGroups(): Promise<KpiGroup[]>;
  getBlocks(): Promise<Blocks>;
  getBlockSections(): Promise<BlockSections>;
  getIndicatorDefs(): Promise<Record<string, string>>;
  getDefinitions(): Promise<Record<string, CompositeDefinition>>;
  getTrendSeries(): Promise<TrendSeries>;
  getFacilities(): Promise<FacilityRow[]>;
  getStateScores(): Promise<Record<string, number>>;
  getStateDonors(): Promise<Record<string, string[]>>;
}
