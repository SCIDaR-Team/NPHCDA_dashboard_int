import type { DataSource } from './types';
import type {
  Blocks,
  BlockSections,
  CompositeDefinition,
  FacilityRow,
  Indicator,
  KpiGroup,
  Split4,
  TrendSeries,
} from '../types';
import { blocks, blockSections, INDICATOR_DEFS, DEFINITIONS } from '../mock/indicators';
import { kpiGroups } from '../mock/kpis';
import { trendSeries } from '../mock/trends';
import { FD_DATA } from '../mock/facilities';
import { STATE_SCORE, STATE_DONORS } from '../geo/states';
import { quarterlyToMonthly } from '../calculations';

/**
 * Live snapshot data source.
 *
 * Reads the static JSON snapshot produced by the ETL (`npm run data:refresh`,
 * written to /public/data-snapshot/measurements.json) and overlays the real,
 * measured figures onto the PRESERVED indicator catalogue:
 *
 *   - indicators we actually measured  → real `pct` + `value` (+ `split4`)
 *   - everything else                  → forced to the "Data not yet available"
 *                                        empty state (`pct: 0`), never mock numbers
 *
 * The indicator names, tiers, `inverse` flags and calculation math are untouched —
 * this only swaps the value-bearing fields. If the snapshot is missing (ETL never
 * run), it degrades gracefully to the illustrative mock figures so the app still
 * renders.
 */

interface Measurement {
  pct: number;
  value: string;
  split4?: Split4;
  /** Optional precise one-line note that overrides the catalogue meta. */
  meta?: string;
  /** Optional override of the composite-breakdown key. `null` clears it (renders a
   *  plain value card instead of a breakdown chart we can't fully populate). */
  info?: string | null;
  n?: number;
}

interface Snapshot {
  generatedAt: string;
  period: { from: string | null; to: string | null; quarters: string[] };
  sources: { name: string; ok: boolean; error: string | null; rowsFetched: number; facilities: number }[];
  indicators: Record<string, Measurement>;
  kpis: KpiGroup[];
  trends: TrendSeries;
  stateScores: Record<string, number>;
  facilities: FacilityRow[];
}

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data-snapshot/measurements.json`;

export class SnapshotDataSource implements DataSource {
  readonly meta = { mode: 'api' as const, label: 'Live data (source snapshot)' };

  private snapshotPromise: Promise<Snapshot | null> | null = null;

  private load(): Promise<Snapshot | null> {
    if (!this.snapshotPromise) {
      this.snapshotPromise = fetch(SNAPSHOT_URL)
        .then((res) => (res.ok ? (res.json() as Promise<Snapshot>) : null))
        .catch(() => null);
    }
    return this.snapshotPromise;
  }

  /** Overlay measured values onto a deep copy of the preserved catalogue. */
  private overlayBlocks(snap: Snapshot): Blocks {
    const out: Blocks = {};
    for (const [blockName, indicators] of Object.entries(blocks)) {
      out[blockName] = indicators.map((ind): Indicator => {
        const m = snap.indicators[ind.name];
        if (m) {
          return {
            ...ind,
            // Keep exact 0 measurements out of the "data gap" bucket (pct<=0),
            // which is reserved for indicators with no source at all.
            pct: m.pct <= 0 ? 0.1 : m.pct,
            value: m.value,
            split4: m.split4 ?? ind.split4,
            meta: m.meta ?? ind.meta,
            info: m.info === undefined ? ind.info : m.info ?? undefined,
          };
        }
        // No real source → intentional "Data not yet available" empty state.
        return { ...ind, pct: 0, value: '&mdash;' };
      });
    }
    return out;
  }

  async getBlocks(): Promise<Blocks> {
    const snap = await this.load();
    return snap ? this.overlayBlocks(snap) : blocks;
  }

  async getKpiGroups(): Promise<KpiGroup[]> {
    const snap = await this.load();
    return snap?.kpis?.length ? snap.kpis : kpiGroups;
  }

  async getTrendSeries(): Promise<TrendSeries> {
    const snap = await this.load();
    // The ETL emits native monthly (42-pt) series. Fallback mock is quarterly, so
    // expand it to monthly to match the app's native resolution.
    if (snap?.trends && Object.keys(snap.trends).length) return snap.trends;
    return Object.fromEntries(
      Object.entries(trendSeries).map(([name, q]) => [name, quarterlyToMonthly(q, name)])
    );
  }

  async getFacilities(): Promise<FacilityRow[]> {
    const snap = await this.load();
    return snap?.facilities?.length ? snap.facilities : FD_DATA;
  }

  async getStateScores(): Promise<Record<string, number>> {
    const snap = await this.load();
    return snap?.stateScores && Object.keys(snap.stateScores).length ? snap.stateScores : STATE_SCORE;
  }

  // Structural / reference data has no live source — served from the catalogue.
  getBlockSections(): Promise<BlockSections> {
    return Promise.resolve(blockSections);
  }
  getIndicatorDefs(): Promise<Record<string, string>> {
    return Promise.resolve(INDICATOR_DEFS);
  }
  getDefinitions(): Promise<Record<string, CompositeDefinition>> {
    return Promise.resolve(DEFINITIONS);
  }
  getStateDonors(): Promise<Record<string, string[]>> {
    return Promise.resolve(STATE_DONORS);
  }
}
