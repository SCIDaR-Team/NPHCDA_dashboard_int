import type { DataSource } from './types';
import type {
  Blocks,
  BlockSections,
  CompositeDefinition,
  FacilityRow,
  KpiGroup,
  SnapshotMeta,
  TrendSeries,
} from '../types';

/**
 * Production data source — talks to a real backend.
 *
 * This is a ready-to-fill stub. Each method should call your API and return data
 * shaped to the domain types in ../types. The recommended backend contract mirrors
 * these methods one-to-one (see docs/DATA_INTEGRATION.md):
 *
 *   GET {baseUrl}/kpis            -> KpiGroup[]
 *   GET {baseUrl}/blocks          -> Blocks
 *   GET {baseUrl}/block-sections  -> BlockSections
 *   GET {baseUrl}/indicator-defs  -> Record<string,string>
 *   GET {baseUrl}/definitions     -> Record<string,CompositeDefinition>
 *   GET {baseUrl}/trends          -> TrendSeries
 *   GET {baseUrl}/facilities      -> FacilityRow[]
 *   GET {baseUrl}/state-donors    -> Record<string,string[]>
 *
 * Crucially, the *indicator names* returned must match the catalogue in
 * the catalogue (src/data/catalogue.ts) so the preserved calculations and UI keep working unchanged.
 */
export class ApiDataSource implements DataSource {
  readonly meta = { mode: 'api' as const, label: 'Live data' };

  constructor(
    private readonly baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api',
    private readonly token?: string
  ) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  getKpiGroups() {
    return this.get<KpiGroup[]>('/kpis');
  }
  getBlocks() {
    return this.get<Blocks>('/blocks');
  }
  getBlockSections() {
    return this.get<BlockSections>('/block-sections');
  }
  getIndicatorDefs() {
    return this.get<Record<string, string>>('/indicator-defs');
  }
  getDefinitions() {
    return this.get<Record<string, CompositeDefinition>>('/definitions');
  }
  getTrendSeries() {
    return this.get<TrendSeries>('/trends');
  }
  getFacilities() {
    return this.get<FacilityRow[]>('/facilities');
  }
  getStateDonors() {
    return this.get<Record<string, string[]>>('/state-donors');
  }
  async getSnapshotMeta(): Promise<SnapshotMeta | null> {
    // Optional endpoint — degrade gracefully if the backend doesn't expose it.
    try {
      return await this.get<SnapshotMeta>('/snapshot-meta');
    } catch {
      return null;
    }
  }
}
