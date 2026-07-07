import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Skeleton, Badge } from '@/components/ui';
import { IndicatorViz, vizFor, vizEmbedsValue } from '@/components/dashboard/indicatorViz';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { scopedKpiValue, scopeLabel, statusFor, looksLikePercent } from '@/data/calculations';
import { decodeHtml } from '@/lib/format';
import type { KpiGroup, Indicator, Blocks, TrendSeries } from '@/data/types';

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
  const scope = scopeLabel(filter);
  const scopeActive = !!(
    filter.state ||
    filter.zone ||
    filter.donor ||
    filter.lga ||
    filter.ward ||
    filter.facilityType ||
    filter.facility ||
    filter.year ||
    filter.month
  );

  const byName: Record<string, Indicator> = {};
  if (blocks) Object.values(blocks).forEach((list) => list.forEach((i) => (byName[i.name] = i)));

  if (loading || !groups) {
    // Mirror the real grouped 3-column layout so nothing shifts when data resolves.
    return (
      <div className="grid gap-x-4 gap-y-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g}>
            <Skeleton className="mb-2 h-3 w-24" />
            <div className="grid gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-card" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-x-4 gap-y-5 lg:grid-cols-3">
      {groups.map((grp) => (
        <div key={grp.group}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-2">
            {decodeHtml(grp.group)}
          </p>
          <div className="grid gap-4">
            {grp.cards.map((card) => {
              const scoped = scopedKpiValue(card, filter);
              const up = card.dir === 'up';
              const ind = card.indicator ? byName[card.indicator] : undefined;
              const spec = card.indicator ? vizFor(card.indicator) : undefined;

              // Render the indicator's theme-section chart, but only at national scope —
              // a national distribution must never be mislabelled under an active filter.
              const showViz = !!ind && !!spec && !scopeActive && ind.pct > 0 && !ind.split4;
              const embeds = !!card.indicator && vizEmbedsValue(card.indicator);
              const showValue = !showViz || !embeds;
              const isPct = looksLikePercent(scoped.value);
              // The kpiStat chart carries its own period delta — don't repeat it here.
              const showDelta = !(showViz && spec?.kind === 'kpiStat');

              return (
                <Card key={card.label} className="flex h-full min-h-[300px] flex-col p-4" hover>
                  <div className="min-h-[32px] text-xs font-medium leading-snug text-muted">
                    {decodeHtml(card.label)}
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
                      {card.delta}
                    </div>
                  )}
                  <div className="mt-0.5 text-[11px] text-muted">{decodeHtml(card.target)}</div>
                  {scoped.scoped && (
                    <div className="mt-0.5 text-[11px] font-semibold text-brand-bright">
                      Scoped to: {scope}
                    </div>
                  )}

                  {/* The theme-section chart (national scope). Fixed band keeps the six cards aligned. */}
                  <div className="mt-auto flex h-[148px] flex-col justify-center pt-3">
                    {showViz ? (
                      <IndicatorViz indicator={ind!} spec={spec!} siblings={byName} trends={trends ?? null} />
                    ) : scopeActive ? (
                      <div className="rounded-lg border border-dashed border-border bg-bg-elev-2/40 px-3 py-4 text-center text-[10.5px] leading-snug text-muted">
                        National distribution hidden under an active filter. The value above is scoped to{' '}
                        <b className="text-text-soft">{scope}</b>.
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
