import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Layers, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, Badge, Input, Select, EmptyState, GroupedDropdownBar, type DropdownGroup } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { getDataSource } from '@/data/datasource';
import { useAsync } from '@/hooks/useAsync';
import { useSnapshotStore } from '@/store/snapshotStore';
import { FD_COLUMNS, FD_NO_DATA_COLUMNS, FD_COLUMN_GROUPS } from '@/data/config';
import { facilityMeasures, heatColor } from '@/data/calculations';
import { pfmoRegistry, type PfmoFacilityRow } from '@/data/pfmoRegistry';
import type { ScopedMeasure } from '@/data/scopedEngine';
import { ZONE_OF_STATE, STATE_DONORS } from '@/data/geo/states';
import { cn } from '@/lib/cn';
import type { FacilityColumn, FacilityRow, FilterState } from '@/data/types';

/**
 * The Facility Deepdive serves two DISTINCT facility universes:
 *   - "assessed"  — the ~637 SRH/SFM/Sheet roster that was physically assessed
 *                   (carries type / functional status / tracer commodities);
 *   - "registry"  — PFMO's ~28k national PHC reporting registry (carries service
 *                   flows: Penta 3, live births, maternal & under-5 deaths).
 * They barely overlap (see the overlap check in the review), so PFMO is its own
 * mode rather than extra columns merged onto the assessed rows.
 */
type Mode = 'assessed' | 'registry';

/** Global-scope match (zone / donor / ward / facility type / facility from the dashboard filters). */
function globalMatch(row: FacilityRow, f: FilterState): boolean {
  // Prefer the dimensions the ETL stamped onto the row; fall back to deriving from state.
  const zone = row.zone ?? ZONE_OF_STATE[row.state];
  const donors = row.donor ?? STATE_DONORS[row.state] ?? [];
  if (f.zone && zone !== f.zone) return false;
  if (f.ward && row.ward !== f.ward) return false;
  if (f.facilityType && row.type !== f.facilityType) return false;
  if (f.facility && row.facility !== f.facility) return false;
  if (f.donor && !donors.includes(f.donor)) return false;
  return true;
}

/** Global-scope match for PFMO registry rows. PFMO carries no facility TYPE or WARD,
 *  so those dashboard filters don't apply here (filtering on them would wrongly empty
 *  the whole registry) — only zone / donor / facility name are honoured. */
function registryGlobalMatch(row: PfmoFacilityRow, f: FilterState): boolean {
  const zone = row.zone ?? ZONE_OF_STATE[row.state];
  const donors = row.donor ?? STATE_DONORS[row.state] ?? [];
  if (f.zone && zone !== f.zone) return false;
  if (f.facility && row.facility !== f.facility) return false;
  if (f.donor && !donors.includes(f.donor)) return false;
  return true;
}

function statusTone(status: string) {
  if (status === 'L2' || status === 'L1') return 'good' as const;
  if (status === 'Partial') return 'mid' as const;
  return 'poor' as const;
}

/** Real numeric value for a plain roster column, or null when it has no live source. */
function numericValue(row: FacilityRow, key: string): number | null {
  if (FD_NO_DATA_COLUMNS.has(key)) return null;
  const raw = (row as any)[key];
  return typeof raw === 'number' ? raw : null;
}

/** Per-facility engine key — matches facilityMeasures' `state|lga|facility` keying. */
const facKey = (r: FacilityRow): string => `${r.state}|${r.lga}|${r.facility}`;

/** First number in a display string, honouring ₦/k/m/bn suffixes (mirrors the
 *  Indicator modal), so counts, percents and ₦ amounts sort by real magnitude. */
function magnitudeOf(display: string, pct: number): number {
  const s = String(display).replace(/,/g, '');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return pct;
  let n = parseFloat(m[0]);
  const after = s.slice((m.index ?? 0) + m[0].length);
  if (/^\s*bn/i.test(after)) n *= 1e9;
  else if (/^\s*m/i.test(after)) n *= 1e6;
  else if (/^\s*k/i.test(after)) n *= 1e3;
  return n;
}

/** A resolved indicator-backed cell (or null when this facility has no measurement). */
interface IndicatorCell {
  num: number;
  display: string;
  pct: number;
}
function indicatorCell(
  maps: Record<string, Record<string, ScopedMeasure>>,
  col: FacilityColumn,
  row: FacilityRow
): IndicatorCell | null {
  const m = maps[col.key]?.[facKey(row)];
  if (!m) return null;
  return { num: m.num ?? magnitudeOf(m.value, m.pct), display: m.value, pct: m.pct };
}

/** Columns rendered left-aligned (categorical badges); the rest are right-aligned numbers. */
const leftAligned = (c: FacilityColumn): boolean => c.key === 'type' || c.key === 'status' || c.fmt === 'bool';

/** Plain-text form of an indicator cell (for CSV export and the Yes/No badge). */
function cellText(col: FacilityColumn, cell: IndicatorCell): string {
  if (col.fmt === 'bool') return cell.pct >= 50 ? 'Yes' : 'No';
  if (col.fmt === 'naira') return cell.display.replace(/\s*received$/i, '');
  return cell.display; // count ("1,234") / pct ("95%") already formatted by the engine
}

type SortKey = 'state' | 'lga' | 'facility' | string;
type SortDir = 'asc' | 'desc';

/** Facility rows shown per page in the matrix. */
const PAGE_SIZE = 50;

/** Fixed metric columns for the PFMO registry mode (no toggle pills — all real). */
const REGISTRY_COLUMNS: { key: string; label: string; group: string }[] = [
  { key: 'penta3Pct', label: 'Penta 3 %', group: 'Immunization' },
  { key: 'livebirths', label: 'Live births', group: 'Maternal & child health' },
  { key: 'maternalDeaths', label: 'Maternal deaths', group: 'Maternal & child health' },
  { key: 'under5Deaths', label: 'Under-5 deaths', group: 'Maternal & child health' },
  { key: 'tracer6Pct', label: 'Tracer 6/6 %', group: 'Facility readiness' },
  { key: 'equip5Pct', label: 'Equipment 5/5 %', group: 'Facility readiness' },
  { key: 'svc6Pct', label: 'Essential services 6/6 %', group: 'Facility readiness' },
  { key: 'months', label: 'Months reported', group: 'Reporting coverage' },
];

/** Toggle-pill group order for the registry column picker (each name describes its
 *  indicators; table columns render in this order too). */
const REGISTRY_COLUMN_GROUPS = ['Immunization', 'Maternal & child health', 'Facility readiness', 'Reporting coverage'];

/** Registry columns that are a percentage which gaps to "No data" (never a false 0). */
const REGISTRY_PCT_KEYS = new Set(['penta3Pct', 'tracer6Pct', 'equip5Pct', 'svc6Pct']);

/** First readiness column — carries a thin left divider to separate service flows
 *  from the readiness group (organisational only). */
const REGISTRY_READINESS_START = 'tracer6Pct';
const registryDivider = (key: string) => (key === REGISTRY_READINESS_START ? 'border-l border-border-soft' : undefined);

const EMPTY_REGISTRY: PfmoFacilityRow[] = [];

/** Stable State → LGA → Facility tiebreaker so equal sort keys keep a natural order. */
const tiebreak = (
  a: { state: string; lga: string; facility: string },
  b: { state: string; lga: string; facility: string }
) => a.state.localeCompare(b.state) || a.lga.localeCompare(b.lga) || a.facility.localeCompare(b.facility);

export function FacilityDeepdivePage() {
  const globalFilter = useFilterStore(pickFilter);
  const ds = getDataSource();
  const { data: facilities } = useAsync(() => ds.getFacilities());
  const FAC = useMemo(() => facilities ?? [], [facilities]);
  // PFMO registry is derived from the snapshot facts (aggregated once, memoised).
  const facts = useSnapshotStore((s) => s.facts);
  // The registry is ~28k facilities — an expensive derivation. Defer building it
  // until the user first opens the registry tab (then keep it, cached). Assessed
  // mode never pays this cost.
  const [registryRequested, setRegistryRequested] = useState(false);
  const pfmoBase = useMemo(
    () => (facts && registryRequested ? pfmoRegistry() : EMPTY_REGISTRY),
    [facts, registryRequested]
  );

  // Per-programme sets of facility keys (state|lga|facility) derived from the raw
  // source facts, so the Programme filter can scope the roster by which source a
  // facility actually reports through. SRH spans its ODK form AND its Sheet baseline.
  const sourceFacilityKeys = useMemo(() => {
    if (!facts) return null;
    const keyOf = (r: { state?: string; lga?: string; facility?: string }) =>
      `${r.state ?? ''}|${r.lga ?? ''}|${r.facility ?? ''}`;
    const build = (...arrs: { facility?: string }[][]) => {
      const s = new Set<string>();
      for (const arr of arrs) for (const r of arr) if (r.facility) s.add(keyOf(r));
      return s;
    };
    return {
      SRH: build(facts.srh, facts.sheet),
      SFM: build(facts.sfm),
      MAMII: build(facts.mamii ?? []),
      PFMO: build(facts.pfmo ?? []),
    } as Record<string, Set<string>>;
  }, [facts]);

  // Per-facility measurements for the indicator-backed matrix columns, pulled from
  // the SAME shared engine the Indicator modal uses (memoised per facts load, so
  // this just indexes into a pre-computed table). Keyed by `state|lga|facility`.
  const indicatorCols = useMemo(() => FD_COLUMNS.filter((c) => c.indicator), []);
  const measureMaps = useMemo(() => {
    const maps: Record<string, Record<string, ScopedMeasure>> = {};
    if (!facts) return maps;
    for (const c of indicatorCols) maps[c.key] = facilityMeasures(c.indicator!);
    return maps;
  }, [facts, indicatorCols]);

  // Toggle-pill columns, shaped into the compact "Columns" dropdown, grouped by theme.
  const columnGroups: DropdownGroup[] = useMemo(
    () =>
      FD_COLUMN_GROUPS.map((group) => ({
        label: group,
        items: FD_COLUMNS.filter((c) => !c.always && c.group === group).map((c) => ({ key: c.key, label: c.label })),
      })).filter((g) => g.items.length),
    []
  );

  // Registry column picker, grouped the same way (service flows vs readiness).
  const registryColumnGroups: DropdownGroup[] = useMemo(
    () =>
      REGISTRY_COLUMN_GROUPS.map((group) => ({
        label: group,
        items: REGISTRY_COLUMNS.filter((c) => c.group === group).map((c) => ({ key: c.key, label: c.label })),
      })),
    []
  );

  const [mode, setMode] = useState<Mode>('assessed');

  // First time the registry tab is opened, request its (deferred) build.
  useEffect(() => {
    if (mode === 'registry') setRegistryRequested(true);
  }, [mode]);

  // Local-only controls (independent of the global dashboard filters).
  const [localState, setLocalState] = useState('');
  const [localLga, setLocalLga] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [groupByState, setGroupByState] = useState(true);
  const [activeCols, setActiveCols] = useState<Set<string>>(new Set(['tracer']));
  // Registry columns default to ALL on (its metrics are few and all real); the picker
  // lets users hide any they don't need.
  const [registryCols, setRegistryCols] = useState<Set<string>>(new Set(REGISTRY_COLUMNS.map((c) => c.key)));
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'state', dir: 'asc' });

  // Switching universes resets scope + sort — the two modes have different states,
  // LGAs and sortable columns, so carrying them over would produce empty views.
  useEffect(() => {
    setLocalState('');
    setLocalLga('');
    setSort({ key: 'state', dir: 'asc' });
  }, [mode]);

  // A Programme filter maps onto the two universes: PFMO → the national registry,
  // every other source → the assessed roster. Auto-switch so the user lands on the
  // universe that can actually hold the selected programme's facilities.
  useEffect(() => {
    if (!globalFilter.source) return;
    setMode(globalFilter.source === 'PFMO' ? 'registry' : 'assessed');
  }, [globalFilter.source]);

  // Effective state: local override wins; otherwise inherit the dashboard's state filter.
  const effectiveState = localState || globalFilter.state;
  const effectiveSearch = localSearch || globalFilter.search;

  // Filter dropdowns reflect whichever universe is active.
  const optionBase = mode === 'registry' ? pfmoBase : FAC;
  const stateOptions = useMemo(() => Array.from(new Set(optionBase.map((r) => r.state))).sort(), [optionBase]);
  const lgaOptions = useMemo(() => {
    const src = optionBase.filter((r) => (effectiveState ? r.state === effectiveState : true));
    return Array.from(new Set(src.map((r) => r.lga))).sort();
  }, [optionBase, effectiveState]);

  // ---- Assessed roster (SRH/SFM/Sheet) -------------------------------------
  const rows = useMemo(() => {
    if (mode !== 'assessed') return [] as FacilityRow[];
    const dir = sort.dir === 'asc' ? 1 : -1;
    let out = FAC.filter((r) => globalMatch(r, globalFilter));
    // Programme (source) scope: SRH/SFM narrow the roster to that source's facilities;
    // PFMO/MAMII have no assessed rows at all (PFMO lives in the registry universe,
    // MAMII carries no per-facility roster row).
    if (globalFilter.source) {
      if (globalFilter.source === 'SRH' || globalFilter.source === 'SFM') {
        const set = sourceFacilityKeys?.[globalFilter.source];
        out = set ? out.filter((r) => set.has(`${r.state}|${r.lga}|${r.facility}`)) : [];
      } else {
        return [] as FacilityRow[];
      }
    }
    if (effectiveState) out = out.filter((r) => r.state === effectiveState);
    else if (globalFilter.lga) out = out.filter((r) => r.lga === globalFilter.lga);
    if (localLga) out = out.filter((r) => r.lga === localLga);
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      out = out.filter(
        (r) =>
          r.facility.toLowerCase().includes(q) ||
          r.lga.toLowerCase().includes(q) ||
          r.state.toLowerCase().includes(q)
      );
    }
    const sortCol = FD_COLUMNS.find((c) => c.key === sort.key);
    const cmp = (a: FacilityRow, b: FacilityRow) => {
      const get = (r: FacilityRow): string | number => {
        if (sort.key === 'state' || sort.key === 'lga' || sort.key === 'facility') return r[sort.key];
        if (sort.key === 'type' || sort.key === 'status') return (r as any)[sort.key];
        // Indicator-backed columns rank by real magnitude; facilities with no
        // measurement sink to the bottom (like a null value elsewhere).
        if (sortCol?.indicator) return indicatorCell(measureMaps, sortCol, r)?.num ?? -1;
        return numericValue(r, sort.key) ?? -1;
      };
      const av = get(a);
      const bv = get(b);
      let c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      c *= dir;
      return c !== 0 ? c : tiebreak(a, b);
    };
    return [...out].sort(cmp);
  }, [mode, FAC, globalFilter, effectiveState, localLga, effectiveSearch, sort, sourceFacilityKeys, measureMaps]);

  // ---- PFMO national registry ----------------------------------------------
  const registryRows = useMemo(() => {
    if (mode !== 'registry') return EMPTY_REGISTRY;
    // The registry IS the PFMO universe, so any non-PFMO programme filter empties it.
    if (globalFilter.source && globalFilter.source !== 'PFMO') return EMPTY_REGISTRY;
    const dir = sort.dir === 'asc' ? 1 : -1;
    let out = pfmoBase.filter((r) => registryGlobalMatch(r, globalFilter));
    if (effectiveState) out = out.filter((r) => r.state === effectiveState);
    else if (globalFilter.lga) out = out.filter((r) => r.lga === globalFilter.lga);
    if (localLga) out = out.filter((r) => r.lga === localLga);
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      out = out.filter(
        (r) =>
          r.facility.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.lga.toLowerCase().includes(q) ||
          r.state.toLowerCase().includes(q)
      );
    }
    const cmp = (a: PfmoFacilityRow, b: PfmoFacilityRow) => {
      const get = (r: PfmoFacilityRow): string | number => {
        if (sort.key === 'state' || sort.key === 'lga' || sort.key === 'facility') return r[sort.key];
        const v = (r as any)[sort.key];
        return typeof v === 'number' ? v : -1; // null Penta 3 % sinks to the bottom
      };
      const av = get(a);
      const bv = get(b);
      let c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      c *= dir;
      return c !== 0 ? c : tiebreak(a, b);
    };
    return [...out].sort(cmp);
  }, [mode, pfmoBase, globalFilter, effectiveState, localLga, effectiveSearch, sort]);

  const isRegistry = mode === 'registry';
  const displayRows: (FacilityRow | PfmoFacilityRow)[] = isRegistry ? registryRows : rows;

  const assessedKpis = useMemo(() => {
    const total = rows.length;
    const cemonc = rows.filter((r) => r.type === 'CEmONC').length;
    const bemonc = rows.filter((r) => r.type === 'BEmONC').length;
    const l2 = rows.filter((r) => r.status === 'L2').length;
    const states = new Set(rows.map((r) => r.state)).size;
    return { total, cemonc, bemonc, l2, states };
  }, [rows]);

  const registryKpis = useMemo(() => {
    const total = registryRows.length;
    const states = new Set(registryRows.map((r) => r.state)).size;
    const births = registryRows.reduce((a, r) => a + r.livebirths, 0);
    const matDeaths = registryRows.reduce((a, r) => a + r.maternalDeaths, 0);
    const p1 = registryRows.reduce((a, r) => a + r.penta1, 0);
    const p3 = registryRows.reduce((a, r) => a + r.penta3, 0);
    const avgPenta = p1 ? Math.round((p3 / p1) * 100) : 0;
    return { total, states, births, matDeaths, avgPenta };
  }, [registryRows]);

  // Paginate the matrix. Any change to the displayed set sends us back to page 1.
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [displayRows]);
  const pageCount = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount); // guard against a stale page after the list shrinks
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedRows = useMemo(() => displayRows.slice(pageStart, pageStart + PAGE_SIZE), [displayRows, pageStart]);

  const cols = FD_COLUMNS.filter((c) => c.always || activeCols.has(c.key));
  const regCols = REGISTRY_COLUMNS.filter((c) => registryCols.has(c.key));
  const registryColCount = 3 + regCols.length;
  const assessedColCount = 3 + cols.length;

  const exportRows = useMemo(() => {
    if (isRegistry) {
      return registryRows.map((r) => {
        const base: Record<string, unknown> = {
          State: r.state,
          Zone: r.zone ?? ZONE_OF_STATE[r.state] ?? '',
          LGA: r.lga,
          Facility: r.facility,
          Code: r.code,
        };
        regCols.forEach((c) => {
          const v = (r as any)[c.key];
          base[c.label] = REGISTRY_PCT_KEYS.has(c.key) ? v ?? 'No data' : v;
        });
        return base;
      });
    }
    return rows.map((r) => {
      const base: Record<string, unknown> = {
        State: r.state,
        Zone: r.zone ?? ZONE_OF_STATE[r.state] ?? '',
        LGA: r.lga,
        Facility: r.facility,
      };
      cols.forEach((c) => {
        if (c.key === 'type' || c.key === 'status') {
          base[c.label] = (r as any)[c.key];
        } else if (c.indicator) {
          const cell = indicatorCell(measureMaps, c, r);
          base[c.label] = cell ? cellText(c, cell) : 'No data';
        } else {
          base[c.label] = numericValue(r, c.key) ?? 'No data';
        }
      });
      return base;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegistry, registryRows, rows, cols, regCols, measureMaps]);

  const toggleCol = (key: string) =>
    setActiveCols((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const toggleRegCol = (key: string) =>
    setRegistryCols((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const SortHeader = ({
    label,
    k,
    align = 'left',
    extraClass,
  }: {
    label: string;
    k: SortKey;
    align?: 'left' | 'right';
    extraClass?: string;
  }) => (
    <th
      scope="col"
      aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2.5 font-semibold', align === 'right' && 'text-right', extraClass)}
    >
      <button
        onClick={() => toggleSort(k)}
        aria-label={`Sort by ${label}`}
        className={cn(
          'inline-flex items-center gap-1 rounded hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        {label}
        {sort.key === k ? (
          sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );

  // Explicit loading condition: the registry can't exist until the snapshot facts
  // load and its (deferred) build has been requested. This never mistakes a
  // genuinely empty filtered result for "still loading".
  const registryLoading = isRegistry && (!facts || !registryRequested);

  return (
    <div>
      <PageHeader
        title="Facility Deepdive"
        subtitle={
          isRegistry
            ? 'PFMO national PHC reporting registry — one row per facility, service flows summed across reporting months. A separate universe from the assessed roster.'
            : 'State → LGA → Facility matrix, from the live facility register. This table has its own local State, LGA and search controls, layered on top of the dashboard scope.'
        }
        actions={
          <ExportMenu
            filename={isRegistry ? 'nphcda-pfmo-registry' : 'nphcda-facilities'}
            rows={exportRows}
          />
        }
      />

      {/* Universe toggle */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-bg-elev-2 p-0.5">
        {([
          ['assessed', 'Assessed facilities', FAC.length],
          ['registry', 'National PHC registry', pfmoBase.length],
        ] as [Mode, string, number][]).map(([m, label, count]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand/60',
              mode === m ? 'bg-brand text-white' : 'text-muted hover:text-text'
            )}
          >
            {label}
            {count > 0 && <span className="ml-1.5 opacity-70">({count.toLocaleString('en-US')})</span>}
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {isRegistry ? (
          <>
            <KpiTile label="Registered facilities" value={registryKpis.total.toLocaleString('en-US')} sub={`Across ${registryKpis.states} state(s)`} />
            <KpiTile label="States represented" value={registryKpis.states} sub="In current view" />
            <KpiTile label="Live births (period)" value={registryKpis.births.toLocaleString('en-US')} sub="Summed across reporting months" />
            <KpiTile label="Maternal deaths" value={registryKpis.matDeaths.toLocaleString('en-US')} sub="Summed across reporting months" />
            <KpiTile label="Avg Penta 3 completion" value={`${registryKpis.avgPenta}%`} sub="Penta3 ÷ Penta1, weighted" />
          </>
        ) : (
          <>
            <KpiTile label="Assessed facilities" value={assessedKpis.total} sub={`Across ${assessedKpis.states} state(s)`} />
            <KpiTile
              label="CEmONC facilities"
              value={assessedKpis.cemonc}
              sub={`${assessedKpis.total ? Math.round((assessedKpis.cemonc / assessedKpis.total) * 100) : 0}% of assessed`}
            />
            <KpiTile
              label="BEmONC facilities"
              value={assessedKpis.bemonc}
              sub={`${assessedKpis.total ? Math.round((assessedKpis.bemonc / assessedKpis.total) * 100) : 0}% of assessed`}
            />
            <KpiTile
              label="L2-functional facilities"
              value={assessedKpis.l2}
              sub={`${assessedKpis.total ? Math.round((assessedKpis.l2 / assessedKpis.total) * 100) : 0}% of assessed`}
            />
            <KpiTile label="States represented" value={assessedKpis.states} sub="In current view" />
          </>
        )}
      </div>

      <SectionBlock title={isRegistry ? 'National PHC registry (PFMO)' : 'Facility matrix'}>
        {/* Local controls */}
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="mb-1.5 block text-xs font-semibold text-text-soft">State</label>
            <Select
              className="h-9"
              value={localState}
              onChange={(e) => {
                setLocalState(e.target.value);
                setLocalLga('');
              }}
              options={[{ value: '', label: globalFilter.state ? `Dashboard: ${globalFilter.state}` : 'All states' }, ...stateOptions.map((s) => ({ value: s, label: s }))]}
            />
          </div>
          <div className="w-44">
            <label className="mb-1.5 block text-xs font-semibold text-text-soft">LGA</label>
            <Select
              className="h-9"
              value={localLga}
              onChange={(e) => setLocalLga(e.target.value)}
              options={[{ value: '', label: 'All LGAs' }, ...lgaOptions.map((l) => ({ value: l, label: l }))]}
            />
          </div>
          <div className="relative w-56">
            <label className="mb-1.5 block text-xs font-semibold text-text-soft">Search</label>
            <Search size={15} className="absolute left-3 top-[34px] text-muted" />
            <Input
              className="h-9 pl-9"
              placeholder="Facility, LGA or state…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setGroupByState((g) => !g)}
            aria-pressed={groupByState}
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand/60',
              groupByState ? 'border-brand bg-brand/12 text-brand-bright' : 'border-border text-muted hover:text-text'
            )}
          >
            <Layers size={15} /> Group by state
          </button>
          <button
            onClick={() => {
              setLocalState('');
              setLocalLga('');
              setLocalSearch('');
            }}
            disabled={!localState && !localLga && !localSearch}
            className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={15} /> Reset filters
          </button>
        </div>

        {/* Column picker — one compact dropdown per theme group, so every group is
            visible and columns from different groups can be shown together. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mr-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-2">Columns</span>
          {isRegistry ? (
            <GroupedDropdownBar groups={registryColumnGroups} isChecked={(k) => registryCols.has(k)} onToggle={toggleRegCol} />
          ) : (
            <GroupedDropdownBar groups={columnGroups} isChecked={(k) => activeCols.has(k)} onToggle={toggleCol} />
          )}
        </div>

        {displayRows.length === 0 ? (
          <EmptyState
            icon={<Search size={22} />}
            title={registryLoading ? 'Loading national registry…' : 'No facilities match'}
            description={
              registryLoading
                ? 'The PFMO registry is loading from the snapshot.'
                : 'Try clearing some filters or searching a different facility, LGA or state.'
            }
          />
        ) : (
          <div className="max-h-[620px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-bg-elev-2 text-left text-xs text-muted">
                <tr>
                  <SortHeader label="State" k="state" />
                  <SortHeader label="LGA" k="lga" />
                  <SortHeader label="Facility" k="facility" />
                  {isRegistry
                    ? regCols.map((c) => (
                        <SortHeader key={c.key} label={c.label} k={c.key} align="right" extraClass={registryDivider(c.key)} />
                      ))
                    : cols.map((c) => (
                        <SortHeader key={c.key} label={c.label} k={c.key} align={leftAligned(c) ? 'left' : 'right'} />
                      ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r, i) => {
                  // Show a state header at the top of each page (i === 0) and wherever the
                  // state changes within the page, so grouping stays correct across pages.
                  const newState = groupByState && (i === 0 || pagedRows[i - 1].state !== r.state);
                  return (
                    <Fragment key={pageStart + i}>
                      {newState && (
                        <tr className="bg-bg-elev-3/60">
                          <td
                            colSpan={isRegistry ? registryColCount : assessedColCount}
                            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-bright"
                          >
                            {r.state}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-border-soft hover:bg-bg-elev-2/50">
                        <td className="px-3 py-2 text-muted">{r.state}</td>
                        <td className="px-3 py-2 text-text-soft">{r.lga}</td>
                        <td className="px-3 py-2 font-medium text-text">
                          {isRegistry ? (
                            <>
                              {r.facility}
                              {(r as PfmoFacilityRow).code && (
                                <span className="ml-1.5 text-[12px] font-normal text-muted">{(r as PfmoFacilityRow).code}</span>
                              )}
                            </>
                          ) : (
                            // Drill through to the facility's full cross-block profile.
                            <Link
                              to={`/app/facility/${encodeURIComponent(facKey(r as FacilityRow))}`}
                              className="rounded text-text transition-colors hover:text-brand-bright hover:underline focus-visible:ring-2 focus-visible:ring-brand/60"
                            >
                              {r.facility}
                            </Link>
                          )}
                        </td>
                        {isRegistry
                          ? regCols.map((c) => (
                              <td key={c.key} className={cn('px-3 py-2 text-right', registryDivider(c.key))}>
                                {registryCell(r as PfmoFacilityRow, c.key)}
                              </td>
                            ))
                          : cols.map((c) => {
                              const row = r as FacilityRow;
                              return (
                                <td key={c.key} className={cn('px-3 py-2', !leftAligned(c) && 'text-right')}>
                                  {renderAssessedCell(c, row, measureMaps)}
                                </td>
                              );
                            })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {displayRows.length > 0 && pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, displayRows.length)} of{' '}
              {displayRows.length.toLocaleString('en-US')} facilities
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-border bg-bg-elev-2 px-3 py-1.5 font-semibold text-text transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text"
              >
                Prev
              </button>
              <span className="tabular-nums">
                Page {safePage} / {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="rounded-lg border border-border bg-bg-elev-2 px-3 py-1.5 font-semibold text-text transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionBlock>
    </div>
  );
}

/** Render an assessed-matrix cell: the two categorical badges, an indicator-backed
 *  value (count / percent / ₦ / Yes-No), or a plain roster number — "No data" where
 *  a facility's source doesn't measure the column. */
function renderAssessedCell(
  c: FacilityColumn,
  row: FacilityRow,
  maps: Record<string, Record<string, ScopedMeasure>>
) {
  if (c.key === 'type') return <Badge tone={row.type === 'CEmONC' ? 'info' : 'neutral'}>{row.type}</Badge>;
  if (c.key === 'status') return <Badge tone={statusTone(row.status)}>{row.status}</Badge>;
  const noData = <span className="text-[12px] italic text-muted">No data</span>;
  if (c.indicator) {
    const cell = indicatorCell(maps, c, row);
    if (!cell) return noData;
    if (c.fmt === 'bool') {
      const yes = cell.pct >= 50;
      return <Badge tone={yes ? 'good' : 'poor'}>{yes ? 'Yes' : 'No'}</Badge>;
    }
    // Percentages carry the shared good→bad heat colour; counts and ₦ stay neutral.
    if (c.fmt === 'pct') {
      return (
        <span className="font-semibold tabular-nums" style={{ color: heatColor(cell.pct) }}>
          {cell.display}
        </span>
      );
    }
    return <span className="text-text-soft tabular-nums">{cellText(c, cell)}</span>;
  }
  const num = numericValue(row, c.key);
  return num === null ? noData : <span className="text-text-soft">{num.toLocaleString('en-US')}</span>;
}

/** Render a PFMO registry metric cell (Penta 3 % gaps to "No data" when no Penta1). */
function registryCell(r: PfmoFacilityRow, key: string) {
  if (REGISTRY_PCT_KEYS.has(key)) {
    const v = (r as any)[key] as number | null;
    return v == null ? (
      <span className="text-[12px] italic text-muted">No data</span>
    ) : (
      <span className="text-text-soft">{v}%</span>
    );
  }
  const v = (r as any)[key] as number;
  return <span className="text-text-soft">{v.toLocaleString('en-US')}</span>;
}

function KpiTile({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-card border border-border bg-bg-elev p-4 shadow-card">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-3xl font-extrabold text-text">{value}</div>
      <div className="mt-1 text-[12px] text-muted">{sub}</div>
    </div>
  );
}
