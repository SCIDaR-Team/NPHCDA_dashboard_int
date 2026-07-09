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
  /**
   * Facility readiness — the share of this facility's *reporting months* in which it
   * reported the full set (indicators #17 / #27 / #47). Null when the facility never
   * reported that family, so a gap never reads as a 0%. These are the only per-facility
   * view of these three PFMO measures in the app (the Indicator modal excludes PFMO).
   */
  tracer6Pct: number | null;
  equip5Pct: number | null;
  svc6Pct: number | null;
}

/** Aggregate PFMO facility-month rows into a one-row-per-facility registry. */
/** Running readiness tallies (reported-months and full-set-months per family). */
interface ReadinessAcc {
  commRep: number;
  tracer6: number;
  equipRep: number;
  equip5: number;
  svcRep: number;
  svc6: number;
}

function aggregate(rows: EngineRecord[]): PfmoFacilityRow[] {
  const byKey = new Map<string, PfmoFacilityRow & { _months: Set<string>; _rd: ReadinessAcc }>();
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
        tracer6Pct: null,
        equip5Pct: null,
        svc6Pct: null,
        _months: new Set<string>(),
        _rd: { commRep: 0, tracer6: 0, equipRep: 0, equip5: 0, svcRep: 0, svc6: 0 },
      };
      byKey.set(key, f);
    }
    f.livebirths += r.livebirths || 0;
    f.maternalDeaths += r.maternalDeaths || 0;
    f.under5Deaths += r.under5Deaths || 0;
    f.penta1 += r.penta1 || 0;
    f.penta3 += r.penta3 || 0;
    if (r.month) f._months.add(String(r.month));
    // Readiness: count reporting months and full-set months per commodity/equipment/service family.
    if ((r as any).commReported) { f._rd.commRep++; if ((r as any).tracer6) f._rd.tracer6++; }
    if ((r as any).equipReported) { f._rd.equipRep++; if ((r as any).equip5) f._rd.equip5++; }
    if ((r as any).svcReported) { f._rd.svcRep++; if ((r as any).svc6) f._rd.svc6++; }
  }
  const out: PfmoFacilityRow[] = [];
  const share = (part: number, whole: number): number | null => (whole ? Math.round((part / whole) * 100) : null);
  for (const f of byKey.values()) {
    f.months = f._months.size;
    f.penta3Pct = f.penta1 ? Math.round((f.penta3 / f.penta1) * 100) : null;
    f.tracer6Pct = share(f._rd.tracer6, f._rd.commRep);
    f.equip5Pct = share(f._rd.equip5, f._rd.equipRep);
    f.svc6Pct = share(f._rd.svc6, f._rd.svcRep);
    const { _months, _rd, ...row } = f;
    void _months;
    void _rd;
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
