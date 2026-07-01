import { Fragment, useMemo, useState } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Layers } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, Badge, Input, Select, EmptyState } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { FD_DATA } from '@/data/mock/facilities';
import { FD_COLUMNS } from '@/data/mock/facility-columns';
import { ALL_STATES, ZONE_OF_STATE, STATE_DONORS } from '@/data/geo/states';
import { pseudo } from '@/data/calculations';
import { cn } from '@/lib/cn';
import type { FacilityRow, FilterState } from '@/data/types';

/** Global-scope match (zone/donor/ward/facility from the dashboard filters). */
function globalMatch(row: FacilityRow, f: FilterState): boolean {
  if (f.zone && ZONE_OF_STATE[row.state] !== f.zone) return false;
  if (f.ward && row.ward !== f.ward) return false;
  if (f.facility && row.facility !== f.facility) return false;
  if (f.donor && !(STATE_DONORS[row.state] || []).includes(f.donor)) return false;
  return true;
}

function statusTone(status: string) {
  if (status === 'L2' || status === 'L1') return 'good' as const;
  if (status === 'Partial') return 'mid' as const;
  return 'poor' as const;
}

function numericValue(row: FacilityRow, key: string, period: string): number {
  const raw = (row as any)[key] as number;
  if (period && key !== 'maternalDeaths') {
    const delta = (pseudo(row.facility + row.lga + key + period) - 0.5) * 14;
    return Math.max(2, Math.min(98, Math.round(raw + delta)));
  }
  return raw;
}

type SortKey = 'state' | 'lga' | 'facility' | string;
type SortDir = 'asc' | 'desc';

export function FacilityDeepdivePage() {
  const globalFilter = useFilterStore(pickFilter);

  // Local-only controls (independent of the global dashboard filters).
  const [localState, setLocalState] = useState('');
  const [localLga, setLocalLga] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [groupByState, setGroupByState] = useState(true);
  const [activeCols, setActiveCols] = useState<Set<string>>(new Set(['tracer']));
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'state', dir: 'asc' });

  // Effective state: local override wins; otherwise inherit the dashboard's state filter.
  const effectiveState = localState || globalFilter.state;
  const effectiveSearch = localSearch || globalFilter.search;

  const lgaOptions = useMemo(() => {
    const src = FD_DATA.filter((r) => (effectiveState ? r.state === effectiveState : true));
    return Array.from(new Set(src.map((r) => r.lga))).sort();
  }, [effectiveState]);

  const rows = useMemo(() => {
    let out = FD_DATA.filter((r) => globalMatch(r, globalFilter));
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
    // Sort by the chosen key, always keeping the State → LGA → Facility hierarchy as tiebreaker.
    const dir = sort.dir === 'asc' ? 1 : -1;
    const cmp = (a: FacilityRow, b: FacilityRow) => {
      const get = (r: FacilityRow): string | number => {
        if (sort.key === 'state' || sort.key === 'lga' || sort.key === 'facility') return r[sort.key];
        if (sort.key === 'type' || sort.key === 'status') return (r as any)[sort.key];
        return numericValue(r, sort.key, globalFilter.period);
      };
      const av = get(a);
      const bv = get(b);
      let c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      c *= dir;
      if (c !== 0) return c;
      return (
        a.state.localeCompare(b.state) ||
        a.lga.localeCompare(b.lga) ||
        a.facility.localeCompare(b.facility)
      );
    };
    return [...out].sort(cmp);
  }, [globalFilter, effectiveState, localLga, effectiveSearch, sort]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const tracerHigh = rows.filter((r) => r.tracer >= 70).length;
    const avgSat = total ? Math.round(rows.reduce((a, r) => a + r.satisfaction, 0) / total) : 0;
    const states = new Set(rows.map((r) => r.state)).size;
    return { total, tracerHigh, avgSat, states };
  }, [rows]);

  const cols = FD_COLUMNS.filter((c) => c.always || activeCols.has(c.key));

  const exportRows = useMemo(
    () =>
      rows.map((r) => {
        const base: Record<string, unknown> = { State: r.state, LGA: r.lga, Facility: r.facility };
        cols.forEach((c) => {
          base[c.label] =
            c.key === 'type' || c.key === 'status'
              ? (r as any)[c.key]
              : numericValue(r, c.key, globalFilter.period) + (c.key === 'maternalDeaths' ? '' : '%');
        });
        return base;
      }),
    [rows, cols, globalFilter.period]
  );

  const toggleCol = (key: string) =>
    setActiveCols((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const SortHeader = ({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => (
    <th className={cn('px-3 py-2.5 font-semibold', align === 'right' && 'text-right')}>
      <button
        onClick={() => toggleSort(k)}
        className={cn('inline-flex items-center gap-1 hover:text-text', align === 'right' && 'flex-row-reverse')}
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

  return (
    <div>
      <PageHeader
        title="Facility Deepdive"
        subtitle="State → LGA → Facility matrix. This table has its own local State, LGA and search controls, layered on top of the dashboard scope."
        actions={<ExportMenu filename="nphcda-facilities" rows={exportRows} />}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Assessed facilities" value={kpis.total} sub={`Across ${kpis.states} state(s)`} />
        <KpiTile
          label="Tracer commodities ≥70%"
          value={kpis.tracerHigh}
          sub={`${kpis.total ? Math.round((kpis.tracerHigh / kpis.total) * 100) : 0}% of assessed facilities`}
        />
        <KpiTile label="Avg. patient satisfaction" value={`${kpis.avgSat}%`} sub="Across assessed facilities" />
        <KpiTile label="States represented" value={kpis.states} sub="In current view" />
      </div>

      <SectionBlock title="Facility matrix">
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
              options={[{ value: '', label: globalFilter.state ? `Dashboard: ${globalFilter.state}` : 'All states' }, ...ALL_STATES.slice().sort().map((s) => ({ value: s, label: s }))]}
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
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors',
              groupByState ? 'border-brand bg-brand/12 text-brand-bright' : 'border-border text-muted hover:text-text'
            )}
          >
            <Layers size={15} /> Group by state
          </button>
        </div>

        {/* Column pills */}
        <div className="mb-3 flex flex-wrap gap-2">
          {FD_COLUMNS.filter((c) => !c.always).map((c) => (
            <button
              key={c.key}
              onClick={() => toggleCol(c.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                activeCols.has(c.key) ? 'border-brand bg-brand/12 text-brand-bright' : 'border-border text-muted hover:text-text'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Search size={22} />}
            title="No facilities match"
            description="Try clearing some filters or searching a different facility, LGA or state."
          />
        ) : (
          <div className="max-h-[620px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-bg-elev-2 text-left text-xs text-muted">
                <tr>
                  <SortHeader label="State" k="state" />
                  <SortHeader label="LGA" k="lga" />
                  <SortHeader label="Facility" k="facility" />
                  {cols.map((c) => (
                    <SortHeader key={c.key} label={c.label} k={c.key} align={c.key === 'type' || c.key === 'status' ? 'left' : 'right'} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const newState = groupByState && (i === 0 || rows[i - 1].state !== r.state);
                  return (
                    <Fragment key={i}>
                      {newState && (
                        <tr className="bg-bg-elev-3/60">
                          <td colSpan={3 + cols.length} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-bright">
                            {r.state}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-border-soft hover:bg-bg-elev-2/50">
                        <td className="px-3 py-2 text-muted">{r.state}</td>
                        <td className="px-3 py-2 text-text-soft">{r.lga}</td>
                        <td className="px-3 py-2 font-medium text-text">{r.facility}</td>
                        {cols.map((c) => (
                          <td key={c.key} className={cn('px-3 py-2', c.key !== 'type' && c.key !== 'status' && 'text-right')}>
                            {c.key === 'type' ? (
                              <Badge tone={r.type === 'CEmONC' ? 'info' : 'neutral'}>{r.type}</Badge>
                            ) : c.key === 'status' ? (
                              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                            ) : c.key === 'maternalDeaths' ? (
                              <span className="text-text-soft">{r.maternalDeaths}</span>
                            ) : (
                              <span className="text-text-soft">{numericValue(r, c.key, globalFilter.period)}%</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>
    </div>
  );
}

function KpiTile({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-card border border-border bg-bg-elev p-4 shadow-card">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-3xl font-extrabold text-text">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{sub}</div>
    </div>
  );
}
