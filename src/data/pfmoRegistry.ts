import type { EngineRecord } from '../../etl/lib/indicators.mjs';
import { useSnapshotStore } from '@/store/snapshotStore';

/**
 * One row per PFMO facility for the Facility Deepdive's "National PHC registry"
 * view. PFMO is a SEPARATE ~28k-facility universe from the assessed roster (they
 * barely overlap — see FacilityDeepdivePage), so it gets its own table rather than
 * being merged onto the 637 assessed rows.
 *
 * PFMO ships one row per facility-MONTH, so flow fields are SUMMED across each
 * facility's reporting months and Penta 3 is shown as completion (Penta3 ÷ Penta1)
 * — matching indicator #87. The ":CODE" suffix PFMO appends to a facility name
 * (e.g. "Nanti Primary Health Centre:NLAG047") is split out as a stable identifier.
 */
export interface PfmoFacilityRow {
  state: string;
  zone?: string;
  donor?: string[];
  lga: string;
  facility: string;
  code: string;
  /** Distinct reporting months this facility appears in (a data-completeness signal). */
  months: number;
  livebirths: number;
  maternalDeaths: number;
  under5Deaths: number;
  penta1: number;
  penta3: number;
  /** Penta 3 completion (%) = penta3 ÷ penta1, or null when no Penta1 was reported. */
  penta3Pct: number | null;
}

/** Aggregate PFMO facility-month rows into a one-row-per-facility registry. */
function aggregate(rows: EngineRecord[]): PfmoFacilityRow[] {
  const byKey = new Map<string, PfmoFacilityRow & { _months: Set<string> }>();
  for (const r of rows) {
    if (!r.facility) continue;
    const full = String(r.facility);
    const ci = full.indexOf(':');
    const name = ci >= 0 ? full.slice(0, ci).trim() : full;
    const code = ci >= 0 ? full.slice(ci + 1).trim() : '';
    const key = `${r.state ?? ''}|${r.lga ?? ''}|${full}`;
    let f = byKey.get(key);
    if (!f) {
      f = {
        state: r.state,
        zone: r.zone,
        donor: r.donor,
        lga: r.lga,
        facility: name,
        code,
        months: 0,
        livebirths: 0,
        maternalDeaths: 0,
        under5Deaths: 0,
        penta1: 0,
        penta3: 0,
        penta3Pct: null,
        _months: new Set<string>(),
      };
      byKey.set(key, f);
    }
    f.livebirths += r.livebirths || 0;
    f.maternalDeaths += r.maternalDeaths || 0;
    f.under5Deaths += r.under5Deaths || 0;
    f.penta1 += r.penta1 || 0;
    f.penta3 += r.penta3 || 0;
    if (r.month) f._months.add(String(r.month));
  }
  const out: PfmoFacilityRow[] = [];
  for (const f of byKey.values()) {
    f.months = f._months.size;
    f.penta3Pct = f.penta1 ? Math.round((f.penta3 / f.penta1) * 100) : null;
    const { _months, ...row } = f;
    void _months;
    out.push(row);
  }
  return out;
}

/* Memoised on the facts identity so the ~54k→~28k aggregation runs once per load. */
let cacheFacts: EngineRecord[] | null = null;
let cacheVal: PfmoFacilityRow[] | null = null;

/** The PFMO facility registry for the current snapshot (empty until facts load). */
export function pfmoRegistry(): PfmoFacilityRow[] {
  const rows = useSnapshotStore.getState().facts?.pfmo ?? null;
  if (!rows) return [];
  if (cacheFacts !== rows || !cacheVal) {
    cacheVal = aggregate(rows);
    cacheFacts = rows;
  }
  return cacheVal;
}
