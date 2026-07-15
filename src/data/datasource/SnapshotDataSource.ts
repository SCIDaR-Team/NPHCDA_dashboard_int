import type { DataSource } from './types';
import type {
  Blocks,
  BlockSections,
  CompositeDefinition,
  FacilityRow,
  Indicator,
  KpiGroup,
  SnapshotMeta,
  Split4,
  TrendSeries,
} from '../types';
import { blocks, blockSections, INDICATOR_DEFS, DEFINITIONS } from '../catalogue';
import { STATE_DONORS } from '../geo/states';
import type { SnapshotFacts } from '../scopedEngine';
import { useSnapshotStore } from '@/store/snapshotStore';

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
  /** Compact per-source fact table for compound-filter scoping (see scopedEngine). */
  facts?: SnapshotFacts;
  kpis: KpiGroup[];
  trends: TrendSeries;
  facilities: FacilityRow[];
}

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data-snapshot/measurements.json`;

export class SnapshotDataSource implements DataSource {
  readonly meta = { mode: 'api' as const, label: 'Live data (source snapshot)' };

  private snapshotPromise: Promise<Snapshot | null> | null = null;

  private load(): Promise<Snapshot | null> {
    if (!this.snapshotPromise) {
      this.snapshotPromise = fetch(SNAPSHOT_URL)
        .then((res) => {
          if (!res.ok) return null;
          return res.json() as Promise<Snapshot>;
        })
        .then((snap) => {
          // Normalize stray 2027-dated rows to 2026 so they don't appear as
          // future-period submissions in the UI. Only the year is changed;
          // months and other fields are preserved.
          if (snap && (snap as any).facts) {
            const facts = (snap as any).facts as Record<string, any[]>;
            const fixRecord = (r: any) => {
              if (!r || typeof r !== 'object') return r;
              if (typeof r.month === 'string' && /\b2027\b/.test(r.month)) {
                r.month = String(r.month).replace(/\b2027\b/g, '2026');
              }
              if (typeof r.quarter === 'string' && /^2027\b/.test(r.quarter)) {
                r.quarter = String(r.quarter).replace(/^2027/, '2026');
              }
              return r;
            };
            for (const k of Object.keys(facts)) {
              const arr = facts[k];
              if (Array.isArray(arr)) {
                for (let i = 0; i < arr.length; i++) arr[i] = fixRecord(arr[i]);
              }
            }
          }
          useSnapshotStore.getState().setFacts(snap?.facts ?? null);
          useSnapshotStore.getState().setFacilities(snap?.facilities ?? []);
          return snap;
        })
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
    // No snapshot → the neutral catalogue (every indicator an empty state). Never mock.
    return snap ? this.overlayBlocks(snap) : blocks;
  }

  async getKpiGroups(): Promise<KpiGroup[]> {
    const snap = await this.load();
    return snap?.kpis ?? [];
  }

  async getTrendSeries(): Promise<TrendSeries> {
    const snap = await this.load();
    return snap?.trends ?? {};
  }

  async getFacilities(): Promise<FacilityRow[]> {
    const snap = await this.load();
    return snap?.facilities ?? [];
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

  async getSnapshotMeta(): Promise<SnapshotMeta | null> {
    const snap = await this.load();
    if (!snap) return null;
    return { generatedAt: snap.generatedAt, period: snap.period, sources: snap.sources ?? [] };
  }
}
