import { useMemo, useRef, useState } from 'react';
import { Info, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Card, Skeleton } from '@/components/ui';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { NigeriaMap, MapLegend } from '@/components/map/NigeriaMap';
import { MapIndicatorPicker, type MapColorSelection } from '@/components/map/MapIndicatorPicker';
import { StateProfileModal } from '@/components/map/StateProfileModal';
import { PROFILE_INDICATOR_NAMES } from '@/components/map/stateProfile';
import { RingProgress } from '@/components/charts/RingProgress';
import { IndicatorModal } from '@/components/dashboard/IndicatorModal';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ALL_STATES, STATE_DONORS, ZONE_OF_STATE } from '@/data/geo/states';
import { BLOCK_ROUTES } from '@/app/navigation';
import { effectiveIndicatorValue, goodnessFor, stateMeasures, coverageNote } from '@/data/calculations';
import { cleanName, decodeHtml } from '@/lib/format';
import type { Indicator, BlockName, Blocks } from '@/data/types';

export function OverviewPage() {
  const ds = getDataSource();
  const { data: kpiGroups, loading: kpiLoading } = useAsync(() => ds.getKpiGroups());
  const { data: blocks, loading: blocksLoading, error, reload } = useAsync(() => ds.getBlocks());
  const { data: stateScores } = useAsync(() => ds.getStateScores());
  const { data: trends } = useAsync(() => ds.getTrendSeries());

  const filter = useFilterStore(pickFilter);
  const setFilter = useFilterStore((s) => s.set);
  const toast = useNotificationStore((s) => s.toast);
  const navigate = useNavigate();

  const [selection, setSelection] = useState<MapColorSelection>({ name: null });
  const [modalInd, setModalInd] = useState<Indicator | null>(null);
  const [profileState, setProfileState] = useState<string | null>(null);
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
    const scores = stateScores ?? {};

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

    // Composite: use the ETL readiness score where it exists (SRH/SFM states), and
    // otherwise fall back to the average goodness of the curated profile indicators.
    // A state is thus greyed out ONLY when it has no measurement for any of them —
    // i.e. its profile would be empty too — so the map and the profile stay consistent.
    const out: Record<string, number> = {};
    ALL_STATES.forEach((st) => {
      if (scores[st] !== undefined) {
        out[st] = scores[st];
        return;
      }
      let sum = 0;
      let cnt = 0;
      PROFILE_INDICATOR_NAMES.forEach((name) => {
        const ind = allByName[name];
        if (!ind) return;
        const m = stateMeasures(name)[st];
        if (!m) return;
        sum += ind.inverse ? 100 - m.pct : m.pct;
        cnt++;
      });
      if (cnt) out[st] = +(sum / cnt).toFixed(1);
    });
    return out;
  }, [activeInd, stateScores, allByName]);

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
      />

      <KpiStrip groups={kpiGroups} loading={kpiLoading} blocks={blocks} trends={trends} />

      <div className="mt-6" ref={mapRef}>
        <SectionBlock
          title="State map — donor footprint & programme performance"
          action={
            <div className="flex items-center gap-2">
              {blocks && (
                <MapIndicatorPicker blocks={blocks} selection={selection} onChange={setSelection} />
              )}
              <ExportMenu filename="nphcda-state-map" captureRef={mapRef} />
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div>
              <NigeriaMap
                values={mapValues}
                selected={filter.state}
                highlight={highlight}
                onStateClick={setProfileState}
              />
              <div className="mt-3">
                <MapLegend />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border bg-bg-elev-2 p-3 text-xs leading-relaxed text-muted">
                {activeInd ? (
                  <>
                    Showing <b className="text-text-soft">{cleanName(activeInd.name)}</b> (real per-state values;
                    states with no measurement are greyed out).
                    {coverageNote(activeInd) && (
                      <span className="mt-1 block text-warning">{coverageNote(activeInd)}</span>
                    )}
                  </>
                ) : (
                  <>Coloured by composite PHC performance. Pick an indicator above to recolour the map.</>
                )}
                {highlight && (
                  <span className="mt-2 block border-t border-border-soft pt-2 text-text-soft">
                    <b className="text-brand-bright">Filter active</b> — highlighted state{highlight.length > 1 ? 's' : ''} ({highlight.length}):{' '}
                    {highlight.join(', ') || 'none'}.
                  </span>
                )}
                <span className="mt-2 block text-muted-2">
                  Click any state for its full cross-block profile. Use the Filters panel to scope the dashboard.
                </span>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                <Info size={15} className="mt-0.5 flex-shrink-0" />
                <span>
                  <b>Scope note:</b> donor markers reflect the SRH/MNH donor map only. State-level donor
                  spend (₦) is a separate, still-open data gap.
                </span>
              </div>
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
        stateScores={stateScores}
        onClose={() => setProfileState(null)}
        onScope={scopeToState}
      />
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

      {/* The ring is the hero: centred both axes so it never sits in a corner. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
        <div className="relative">
          <RingProgress pct={goodness} size={124} thickness={5} />
          <span className="absolute inset-0 flex items-center justify-center text-[26px] font-extrabold text-text">
            {Math.round(goodness)}
          </span>
        </div>
        <div>
          <div className="text-2xl font-extrabold leading-none text-text">{displayVal}</div>
          <div className="mx-auto mt-1 max-w-[220px] text-[11px] leading-snug text-muted">
            {cleanName(ind.name)}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-center border-t border-border-soft pt-3">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-bright">
          View details <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Card>
  );
}
