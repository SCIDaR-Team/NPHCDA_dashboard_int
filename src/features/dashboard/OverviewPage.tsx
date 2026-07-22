import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Table2, Map as MapIcon, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Card, Skeleton } from '@/components/ui';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { NigeriaMap, MapLegend } from '@/components/map/NigeriaMap';
import { MapIndicatorPicker, type MapColorSelection } from '@/components/map/MapIndicatorPicker';
import { StateProfileModal } from '@/components/map/StateProfileModal';
import { MapMethodology } from '@/components/map/MapMethodology';
import { stateCompositeScore } from '@/components/map/stateProfile';
import { MiniDonut } from '@/components/charts/mini/echartsMinis';
import { CHART_GREEN, CHART_GREEN_FAINT } from '@/components/charts/palette';
import { IndicatorModal } from '@/components/dashboard/IndicatorModal';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { ExecutiveReportButton } from '@/components/dashboard/ExecutiveReportButton';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ALL_STATES, STATE_DONORS, ZONE_OF_STATE } from '@/data/geo/states';
import { BLOCK_ROUTES } from '@/app/navigation';
import { effectiveIndicatorValue, goodnessFor, stateMeasures, heatColor } from '@/data/calculations';
import { cleanName, decodeHtml } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Indicator, BlockName, Blocks } from '@/data/types';

const round1 = (v: number) => Math.round(v * 10) / 10;

export function OverviewPage() {
  const ds = getDataSource();
  const { data: kpiGroups, loading: kpiLoading } = useAsync(() => ds.getKpiGroups());
  const { data: blocks, loading: blocksLoading, error, reload } = useAsync(() => ds.getBlocks());
  const { data: trends } = useAsync(() => ds.getTrendSeries());

  const filter = useFilterStore(pickFilter);
  const setFilter = useFilterStore((s) => s.set);
  const toast = useNotificationStore((s) => s.toast);
  const navigate = useNavigate();

  const [selection, setSelection] = useState<MapColorSelection>({ name: null });
  const [modalInd, setModalInd] = useState<Indicator | null>(null);
  const [profileState, setProfileState] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const allByName = useMemo(() => {
    const m: Record<string, Indicator> = {};
    if (blocks) Object.values(blocks).forEach((list) => list.forEach((i) => (m[i.name] = i)));
    return m;
  }, [blocks]);

  // Map fill values: composite state readiness score (default), or the real per-state
  // goodness of the single selected indicator (from the ETL disaggregation). States
  // with no real measurement are OMITTED so the map paints them as "no data" (grey)
  // rather than colouring a fabricated/zero value.
  const activeInd = selection.name ? allByName[selection.name] : null;
  const mapValues = useMemo<Record<string, number>>(() => {
    // Single indicator selected → colour by its real per-state goodness only.
    if (activeInd) {
      const measures = stateMeasures(activeInd.name);
      const out: Record<string, number> = {};
      ALL_STATES.forEach((st) => {
        const m = measures[st];
        if (!m) return; // no real measurement → left out → painted "no data"
        out[st] = +(activeInd.inverse ? 100 - m.pct : m.pct).toFixed(1);
      });
      return out;
    }

    // Composite: the uniform readiness score — every state is the average goodness of
    // the curated profile indicators it has real data for (see stateCompositeScore).
    // A state is greyed out ONLY when it has no measurement for any of them, so the
    // map and the state profile always agree.
    const out: Record<string, number> = {};
    ALL_STATES.forEach((st) => {
      const v = stateCompositeScore(st, allByName);
      if (v !== null) out[st] = v;
    });
    return out;
  }, [activeInd, allByName]);

  // Accessible table fallback for the SVG choropleth (WCAG) + a quick ranked read.
  const mapRows = useMemo(() => Object.entries(mapValues).sort((a, b) => b[1] - a[1]), [mapValues]);
  const highlight = useMemo<string[] | null>(() => {
    if (filter.state) return [filter.state];
    if (filter.zone) return ALL_STATES.filter((s) => ZONE_OF_STATE[s] === filter.zone);
    if (filter.donor) return ALL_STATES.filter((s) => (STATE_DONORS[s] || []).includes(filter.donor));
    return null;
  }, [filter]);

  // Programme snapshot: one headline Tier-1 indicator per block (exact original logic).
  const snapshot = useMemo<{ block: BlockName; ind: Indicator | undefined }[]>(() => {
    if (!blocks) return [];
    return (Object.keys(blocks) as BlockName[]).map((bn) => ({
      block: bn,
      ind:
        blocks[bn].find((i) => i.tier === 1 && i.pct > 0 && !i.split4) ||
        blocks[bn].find((i) => i.pct > 0 && !i.split4),
    }));
  }, [blocks]);

  // Scope the whole dashboard to a state (from the profile modal's action / filters).
  const scopeToState = (state: string) => {
    setFilter({ state, zone: ZONE_OF_STATE[state] });
    toast({ tone: 'info', title: `Scoped to ${state}`, description: 'All indicators now reflect this state.' });
  };

  // Clear the map selection directly from the map (click the selected state again,
  // or click empty space) — no trip through the General Filter needed.
  const clearMapSelection = () => {
    if (!filter.state) return;
    const prev = filter.state;
    setFilter({ state: '', zone: '', lga: '', ward: '', facility: '' });
    toast({ tone: 'info', title: 'Selection cleared', description: `${prev} is no longer scoped.` });
  };

  const goToBlock = (block: BlockName) => {
    navigate(BLOCK_ROUTES[block]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Top-level outcomes, coverage and system & trust indicators. Click a state on the map for its full cross-block profile."
        actions={<ExecutiveReportButton />}
      />

      <div data-tour="kpi">
        <KpiStrip groups={kpiGroups} loading={kpiLoading} blocks={blocks} trends={trends} />
      </div>

      <div className="mt-6" data-tour="map">
        <SectionBlock
          title="State map — donor footprint & programme performance"
          action={
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {blocks && (
                <MapIndicatorPicker blocks={blocks} selection={selection} onChange={setSelection} />
              )}
              <button
                onClick={() => setShowTable((t) => !t)}
                aria-pressed={showTable}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                {showTable ? <MapIcon size={15} /> : <Table2 size={15} />}
                {showTable ? 'View map' : 'View as table'}
              </button>
              <ExportMenu
                filename="nphcda-state-map"
                captureRef={mapRef}
                onBeforeCapture={() => setCapturing(true)}
                onAfterCapture={() => setCapturing(false)}
              />
            </div>
          }
        >
          <div className="relative">
            {/* What the colouring means sits behind this button rather than being
                printed on the map surface — it opens on demand only. It floats at the
                top-right, level with the map, so the map + legend rise to fill the row
                instead of being pushed down by a header band of their own. */}
            <div className="absolute right-0 -top-2 z-10">
              <MapMethodology activeIndicator={activeInd?.name ?? null} />
            </div>
            {/* Only the map (or table) + legend is captured for the PNG/PDF export —
                the title, controls and caption above are intentionally left out.
                The padding gives the exported image clean margins so the map edges
                and legend never sit flush against the border. */}
            <div ref={mapRef} className="rounded-lg bg-bg-elev px-4 pb-5 pt-3">
              {/* Export-only header: shown only while the image/PDF is being captured
                  so the downloaded file carries a title, without duplicating the
                  on-screen section header. */}
              {capturing && (
                <div className="mb-3 border-b border-border-soft pb-3 text-center">
                  <h3 className="text-base font-extrabold tracking-tight text-text">
                    Nigeria PHC — {activeInd ? cleanName(activeInd.name) : 'Composite performance score'}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {activeInd ? 'Per-state performance (0–100)' : 'Composite state readiness (0–100)'} · NPHCDA
                  </p>
                </div>
              )}
              {showTable ? (
                <>
                  <MapDataTable
                    rows={mapRows}
                    label={activeInd ? cleanName(activeInd.name) : 'Composite score'}
                    onSelect={setProfileState}
                  />
                  <div className="pt-4">
                    <MapLegend />
                  </div>
                </>
              ) : (
                // Map + legend share a row: the legend is a vertical rail on the left
                // (stacked below the map on narrow screens), so it no longer eats a
                // full band of height beneath the map.
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="order-2 sm:order-1 sm:w-auto sm:max-w-[300px] sm:shrink-0">
                    <MapLegend layout="column" />
                  </div>
                  {/* Reserve room on the right for the floating Methodology button so
                      the map sits closer to the legend and its top-right corner never
                      slides under the button (worst case: nav collapsed → wider card).
                      -mt nudges the map up slightly. */}
                  <div className="order-1 min-w-0 flex-1 sm:order-2 sm:-mt-5 sm:pr-36">
                    <NigeriaMap
                      values={mapValues}
                      selected={filter.state}
                      highlight={highlight}
                      onStateClick={setProfileState}
                      onClearSelection={clearMapSelection}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionBlock>
      </div>

      <SectionBlock title="Snapshot by programme area">
        {blocksLoading || !blocks ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.map(({ block, ind }) => (
              <SnapshotCard key={block} block={block} ind={ind} blocks={blocks} onClick={() => goToBlock(block)} />
            ))}
          </div>
        )}
      </SectionBlock>

      <IndicatorModal indicator={modalInd} onClose={() => setModalInd(null)} />

      <StateProfileModal
        state={profileState}
        blocks={blocks ?? null}
        onClose={() => setProfileState(null)}
        onScope={scopeToState}
      />
    </div>
  );
}

/** Accessible, sortable table equivalent of the choropleth — a WCAG-friendly
 *  alternative to the SVG map, sortable by state name (alphabetical) or by value
 *  (magnitude), each ascending or descending. */
function MapDataTable({
  rows,
  label,
  onSelect,
}: {
  rows: [string, number][];
  label: string;
  onSelect?: (state: string) => void;
}) {
  type SortKey = 'state' | 'value';
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' });

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const c =
        sort.key === 'state' ? a[0].localeCompare(b[0]) : a[1] - b[1];
      return c * dir || a[0].localeCompare(b[0]);
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    // Sensible first-click direction per column: names A→Z, values high→low.
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'state' ? 'asc' : 'desc' }));

  const SortTh = ({ label: lbl, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => (
    <th
      scope="col"
      aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2 font-semibold', align === 'right' && 'text-right')}
    >
      <button
        onClick={() => toggle(k)}
        aria-label={`Sort by ${lbl}`}
        className={cn('inline-flex items-center gap-1 rounded hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60', align === 'right' && 'flex-row-reverse')}
      >
        {lbl}
        {sort.key === k ? (
          sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-bg-elev-2 px-4 py-6 text-center text-sm text-muted">
        No states have a measurement for this selection.
      </div>
    );
  }
  return (
    <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">{label} by state — sortable by name or value</caption>
        <thead className="sticky top-0 z-10 bg-bg-elev-2 text-left text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">#</th>
            <SortTh label="State" k="state" />
            <th scope="col" className="px-3 py-2 font-semibold">Donors</th>
            <SortTh label={label} k="value" align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(([state, value], i) => (
            <tr
              key={state}
              className="border-t border-border-soft hover:bg-bg-elev-2/50"
            >
              <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
              <td className="px-3 py-2">
                <button
                  onClick={() => onSelect?.(state)}
                  className="font-medium text-text hover:text-brand-bright focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  {state}
                </button>
              </td>
              <td className="px-3 py-2 text-muted">
                {STATE_DONORS[state]?.length ? STATE_DONORS[state].join(', ') : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <span className="inline-flex items-center gap-2 tabular-nums font-semibold text-text-soft">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: heatColor(value) }} aria-hidden />
                  {Math.round(value)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotCard({
  block,
  ind,
  onClick,
}: {
  block: BlockName;
  ind: Indicator | undefined;
  blocks: Blocks;
  onClick: () => void;
}) {
  const filter = useFilterStore(pickFilter);
  if (!ind) {
    return (
      <Card className="h-full p-5" hover>
        <h3 className="text-sm font-bold text-text">{block}</h3>
        <p className="mt-2 text-xs text-muted">No Tier 1 headline indicator yet.</p>
      </Card>
    );
  }
  const eff = effectiveIndicatorValue(ind, filter);
  const displayVal = eff ? (eff.outOfScope ? '—' : eff.value) : decodeHtml(ind.value);
  const pct = eff && !eff.outOfScope && eff.pct !== undefined ? eff.pct : ind.pct;
  const goodness = goodnessFor({ inverse: ind.inverse, pct });

  // The donut arc always shows "goodness" (higher = better). For a normal indicator
  // that IS its percentage, so the centre shows it directly. For an inverse indicator
  // (lower is better) goodness is not the reported figure, so the centre shows the
  // real value instead rather than a number that contradicts the indicator.
  const centerText = eff?.outOfScope ? '—' : ind.inverse ? displayVal : `${round1(pct)}%`;

  return (
    <Card
      hover
      role="button"
      tabIndex={0}
      aria-label={`${block} — view details`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group flex h-full min-h-[268px] cursor-pointer flex-col p-5"
    >
      <h3 className="text-sm font-bold text-text">{block}</h3>

      {/* Same donut as every other part-to-whole card on the dashboard, so the
          snapshot reads as one visual family with the indicator cards. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
        <MiniDonut
          segments={[
            { name: 'Achieved', value: round1(goodness), color: CHART_GREEN },
            { name: 'Remaining', value: round1(100 - goodness), color: CHART_GREEN_FAINT },
          ]}
          centerText={centerText}
        />
        <div className="mx-auto max-w-[220px] text-[12px] leading-snug text-muted">
          {cleanName(ind.name)}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-center border-t border-border-soft pt-3">
        <span className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-brand-bright">
          View details <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Card>
  );
}
