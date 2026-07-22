import type { CSSProperties } from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Skeleton, Badge, CopyButton } from '@/components/ui';
import { IndicatorViz, vizFor, vizEmbedsValue } from '@/components/dashboard/indicatorViz';
import { TargetChip } from '@/components/dashboard/TargetChip';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useSnapshotStore } from '@/store/snapshotStore';
import { scopedKpiValue, scopeLabel, statusFor, looksLikePercent, scopedSiblings, trendDelta, trendScopeActive } from '@/data/calculations';
import { scopedTrends } from '@/data/scopedEngine';
import { BLOCK_ROUTES, indicatorAnchorId } from '@/app/navigation';
import { decodeHtml } from '@/lib/format';
import type { KpiGroup, Indicator, Blocks, BlockName, TrendSeries } from '@/data/types';

export function KpiStrip({
  groups,
  loading,
  blocks,
  trends,
}: {
  groups: KpiGroup[] | null;
  loading: boolean;
  /** All indicators, so each KPI card can render its theme-section chart. */
  blocks?: Blocks | null;
  trends?: TrendSeries | null;
}) {
  const filter = useFilterStore(pickFilter);
  const facts = useSnapshotStore((s) => s.facts);
  const navigate = useNavigate();
  const scope = scopeLabel(filter);

  // Which thematic (block) page each indicator lives on, so a KPI card can route to
  // the indicator it's pulled from.
  const blockOf: Record<string, BlockName> = {};
  if (blocks) (Object.entries(blocks) as [BlockName, Indicator[]][]).forEach(([bn, list]) => list.forEach((i) => (blockOf[i.name] = bn)));
  const goToIndicator = (name?: string) => {
    const bn = name ? blockOf[name] : undefined;
    if (!bn) return;
    navigate(`${BLOCK_ROUTES[bn]}#${indicatorAnchorId(name!)}`);
  };
  const scopeActive = !!(
    filter.state ||
    filter.zone ||
    filter.donor ||
    filter.source ||
    filter.lga ||
    filter.ward ||
    filter.facilityType ||
    filter.facility ||
    filter.year ||
    filter.month
  );

  // Under a geography/type/donor scope the sparkline + "over period" delta recompute
  // over the filter-scoped trend (period filters don't apply to a time series); else
  // the national series baked into the snapshot.
  const trendScoped = trendScopeActive(filter);
  const effTrends: TrendSeries | null = trendScoped && facts ? scopedTrends(filter) : trends ?? null;

  const byName: Record<string, Indicator> = {};
  if (blocks) Object.values(blocks).forEach((list) => list.forEach((i) => (byName[i.name] = i)));

  if (loading || !groups) {
    // Mirror the real grouped 3-column layout so nothing shifts when data resolves.
    return (
      <div
        className="grid gap-x-4 gap-y-5 lg:grid-cols-3 lg:[grid-template-rows:auto_repeat(2,1fr)]"
      >
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g} className="grid min-w-0 gap-4 lg:row-span-full lg:grid-rows-subgrid">
            <Skeleton className="h-3 w-24" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-full min-h-[336px] rounded-card" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Every column shares ONE set of row tracks (via subgrid), so a card in row 2 of
  // one group is exactly as tall as row 2 of every other group. Without this each
  // column is an independent grid and only equalises heights within itself.
  const rowCount = Math.max(1, ...groups.map((g) => g.cards.length));

  return (
    <div
      className="grid gap-x-4 gap-y-5 lg:grid-cols-3 lg:[grid-template-rows:auto_repeat(var(--kpi-rows),1fr)]"
      style={{ '--kpi-rows': rowCount } as CSSProperties}
    >
      {groups.map((grp) => (
        // min-w-0 is load-bearing: grid items default to min-width:auto, so a card
        // whose content has a wide min-content (the gauge's 0%…100% scale row) would
        // otherwise stretch its column and squeeze the other two out of alignment.
        <div
          key={grp.group}
          className="grid min-w-0 gap-4 lg:row-span-full lg:grid-rows-subgrid"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-2">
            {decodeHtml(grp.group)}
          </p>
          {grp.cards.map((card) => {
              const scoped = scopedKpiValue(card, filter);
              // Rescope the "over period" delta to the filtered trend when a geo scope
              // is active and this card is trend-backed; else the baked national delta.
              const eff =
                trendScoped && card.trendKey
                  ? trendDelta(effTrends?.[card.trendKey], card.trendIsPct)
                  : { delta: card.delta, dir: card.dir };
              const up = eff.dir === 'up';
              const ind = card.indicator ? byName[card.indicator] : undefined;
              const spec = card.indicator ? vizFor(card.indicator) : undefined;

              // The chart stays the SAME under a filter — it just renders the scoped
              // value. Only a scope with no data for this indicator hides the chart.
              const scopedNoData = scopeActive && scoped.value === '—';
              const showViz = !!ind && !!spec && ind.pct > 0 && !ind.split4 && !scopedNoData;
              const embeds = !!card.indicator && vizEmbedsValue(card.indicator);
              const showValue = !showViz || !embeds;
              const isPct = looksLikePercent(scoped.value);
              // The kpiStat chart carries its own period delta — don't repeat it here.
              const showDelta = !(showViz && spec?.kind === 'kpiStat');
              // Feed the chart the scoped value + scoped sibling context under a filter.
              const vizInd: Indicator | undefined =
                ind && scopeActive && showViz ? { ...ind, pct: scoped.pct, value: scoped.value } : ind;
              const vizSiblings = scopeActive ? scopedSiblings(byName, filter) : byName;

              const canRoute = !!(card.indicator && blockOf[card.indicator]);
              return (
                <Card
                  key={card.label}
                  className={`group flex h-full min-h-[336px] flex-col p-4 ${canRoute ? 'cursor-pointer' : ''}`}
                  hover
                  role={canRoute ? 'button' : undefined}
                  tabIndex={canRoute ? 0 : undefined}
                  aria-label={canRoute ? `${decodeHtml(card.label)} — open on its thematic page` : undefined}
                  onClick={canRoute ? () => goToIndicator(card.indicator) : undefined}
                  onKeyDown={
                    canRoute
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goToIndicator(card.indicator);
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex min-h-[32px] items-start justify-between gap-2">
                    <span className="text-xs font-medium leading-snug text-muted">{decodeHtml(card.label)}</span>
                    <span className="flex flex-shrink-0 items-center gap-0.5">
                      <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <CopyButton
                          compact
                          stopPropagation
                          label={`Copy ${decodeHtml(card.label)} figure`}
                          text={`${decodeHtml(card.label)}: ${scoped.value}${
                            scoped.scoped ? ` (${scope})` : ''
                          }.${card.target ? ` ${decodeHtml(card.target)}.` : ''}`}
                        />
                      </span>
                      {canRoute && (
                        <ArrowUpRight
                          size={15}
                          className="text-muted-2 transition-colors group-hover:text-brand-bright"
                        />
                      )}
                    </span>
                  </div>

                  {showValue && (
                    <div className="mt-1.5 flex items-end gap-2">
                      <span className="text-[26px] font-extrabold leading-none text-text">
                        {scoped.value}
                      </span>
                      {isPct && scoped.pct > 0 && (
                        <Badge tone={statusFor(scoped.pct, card.inverse).level} className="mb-0.5">
                          {statusFor(scoped.pct, card.inverse).label}
                        </Badge>
                      )}
                    </div>
                  )}

                  {showDelta && (
                    <div
                      className={`mt-1.5 flex items-center gap-1 text-xs font-bold ${
                        up ? 'text-brand-bright' : 'text-danger'
                      }`}
                    >
                      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {eff.delta}
                    </div>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                    <span>{decodeHtml(card.target)}</span>
                    {card.indicator && isPct && (
                      <TargetChip indicatorName={card.indicator} actualPct={scoped.pct} />
                    )}
                  </div>
                  {scoped.scoped && (
                    <div className="mt-0.5 text-[12px] font-semibold text-brand-bright">
                      Scoped to: {scope}
                    </div>
                  )}

                  {/* The theme-section chart — grows to fill and centres, so the chart is
                      the card's hero and the six cards stay aligned. Same chart when scoped. */}
                  <div className="flex flex-1 flex-col justify-center pt-3">
                    {showViz ? (
                      <IndicatorViz
                        indicator={vizInd!}
                        spec={spec!}
                        siblings={vizSiblings}
                        trends={effTrends}
                        scoped={scopeActive}
                        highlightState={filter.state || undefined}
                      />
                    ) : scopedNoData ? (
                      <div className="rounded-lg border border-dashed border-border bg-bg-elev-2/40 px-3 py-4 text-center text-[11px] leading-snug text-muted">
                        No data for <b className="text-text-soft">{scope}</b> on this indicator.
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
          })}
        </div>
      ))}
    </div>
  );
}
