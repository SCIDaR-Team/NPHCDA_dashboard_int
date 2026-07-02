import { useMemo, useRef, useState } from 'react';
import { Info, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Card, Skeleton } from '@/components/ui';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { NigeriaMap, MapLegend } from '@/components/map/NigeriaMap';
import { MapIndicatorPicker, type MapColorSelection } from '@/components/map/MapIndicatorPicker';
import { RingProgress } from '@/components/charts/RingProgress';
import { IndicatorModal } from '@/components/dashboard/IndicatorModal';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ALL_STATES, STATE_SCORE, STATE_DONORS, ZONE_OF_STATE } from '@/data/geo/states';
import { BLOCK_ROUTES } from '@/app/navigation';
import { coverageStates, effectiveIndicatorValue, goodnessFor, pseudo } from '@/data/calculations';
import { cleanName, decodeHtml } from '@/lib/format';
import type { Indicator, BlockName, Blocks } from '@/data/types';

export function OverviewPage() {
  const ds = getDataSource();
  const { data: kpiGroups, loading: kpiLoading } = useAsync(() => ds.getKpiGroups());
  const { data: blocks, loading: blocksLoading, error, reload } = useAsync(() => ds.getBlocks());

  const filter = useFilterStore(pickFilter);
  const setFilter = useFilterStore((s) => s.set);
  const toast = useNotificationStore((s) => s.toast);
  const navigate = useNavigate();

  const [selection, setSelection] = useState<MapColorSelection>({ names: new Set() });
  const [modalInd, setModalInd] = useState<Indicator | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const allByName = useMemo(() => {
    const m: Record<string, Indicator> = {};
    if (blocks) Object.values(blocks).forEach((list) => list.forEach((i) => (m[i.name] = i)));
    return m;
  }, [blocks]);

  // Map fill values: composite score, or the averaged goodness of selected indicators.
  const mapValues = useMemo<Record<string, number>>(() => {
    if (selection.names.size === 0 || !blocks) return STATE_SCORE;
    const inds = [...selection.names].map((n) => allByName[n]).filter(Boolean);
    const out: Record<string, number> = {};
    ALL_STATES.forEach((st) => {
      let sum = 0;
      let cnt = 0;
      inds.forEach((ind) => {
        if (!coverageStates(ind).includes(st)) return;
        const p = pseudo(st + '|' + ind.pct);
        const v = Math.max(2, Math.min(98, ind.pct + (p - 0.5) * Math.max(18, ind.pct * 0.5)));
        sum += ind.inverse ? 100 - v : v;
        cnt++;
      });
      out[st] = cnt ? +(sum / cnt).toFixed(1) : (STATE_SCORE[st] ?? 0);
    });
    return out;
  }, [selection, blocks, allByName]);

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

  const onStateClick = (state: string) => {
    if (filter.state === state) {
      // Clicking a selected state again deselects it (toggle).
      setFilter({ state: '', zone: '' });
      toast({ tone: 'info', title: `Cleared ${state}`, description: 'Back to national scope.' });
    } else {
      setFilter({ state, zone: ZONE_OF_STATE[state] });
      toast({ tone: 'info', title: `Scoped to ${state}`, description: 'All indicators now reflect this state.' });
    }
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
        subtitle="Top-level outcomes, coverage and system & trust indicators. Click a state on the map to scope the dashboard (click again to clear)."
      />

      <KpiStrip groups={kpiGroups} loading={kpiLoading} />

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
              <NigeriaMap values={mapValues} selected={filter.state} highlight={highlight} onStateClick={onStateClick} />
              <div className="mt-3">
                <MapLegend />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border bg-bg-elev-2 p-3 text-xs leading-relaxed text-muted">
                {selection.names.size > 0 ? (
                  <>
                    Colouring by <b className="text-text-soft">{selection.names.size}</b> selected indicator
                    {selection.names.size > 1 ? 's' : ''} (averaged). Click a state to scope the dashboard.
                  </>
                ) : (
                  <>Click any state to scope the whole dashboard to it; click it again to clear. Use the Filters panel to highlight states too.</>
                )}
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
    <Card hover onClick={onClick} className="group flex h-full cursor-pointer flex-col p-5">
      <h3 className="text-sm font-bold text-text">{block}</h3>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <RingProgress pct={goodness} size={64} />
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-text">
            {Math.round(goodness)}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-xl font-extrabold text-text">{displayVal}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted">{cleanName(ind.name)}</div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-end pt-4">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-bright">
          View details <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Card>
  );
}
