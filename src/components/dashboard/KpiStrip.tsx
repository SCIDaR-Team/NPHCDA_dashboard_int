import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui';
import { Sparkline } from '@/components/charts/Sparkline';
import { RingProgress } from '@/components/charts/RingProgress';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { scopedKpiValue, scopeLabel, heatColor } from '@/data/calculations';
import { decodeHtml } from '@/lib/format';
import type { KpiGroup } from '@/data/types';

export function KpiStrip({ groups, loading }: { groups: KpiGroup[] | null; loading: boolean }) {
  const filter = useFilterStore(pickFilter);
  const scope = scopeLabel(filter);

  if (loading || !groups) {
    // Mirror the real grouped 3-column layout so nothing shifts when data resolves.
    return (
      <div className="grid gap-x-4 gap-y-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g}>
            <Skeleton className="mb-2 h-3 w-24" />
            <div className="grid gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-card" />
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
              const scoped = scopedKpiValue(
                { value: card.value, pct: card.pct, label: card.label },
                filter
              );
              const ringPct = scoped.pct;
              const color = heatColor(card.ringInverse ? 100 - ringPct : ringPct);
              const up = card.dir === 'up';
              return (
                <Card key={card.label} className="relative overflow-hidden p-4" hover>
                  {card.ring !== undefined && (
                    <div className="absolute right-3 top-3">
                      <RingProgress pct={ringPct} inverse={card.ringInverse} />
                    </div>
                  )}
                  <div className="pr-12">
                    <div className="text-xs font-medium leading-snug text-muted">
                      {decodeHtml(card.label)}
                    </div>
                    <div className="mt-1.5 text-[26px] font-extrabold leading-none text-text">
                      {scoped.value}
                    </div>
                    <div
                      className={`mt-1.5 flex items-center gap-1 text-xs font-bold ${
                        up ? 'text-brand-bright' : 'text-danger'
                      }`}
                    >
                      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {card.delta}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">{decodeHtml(card.target)}</div>
                    {scoped.scoped && (
                      <div className="mt-0.5 text-[11px] font-semibold text-brand-bright">
                        Scoped to: {scope}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 h-9">
                    <Sparkline data={card.spark} color={color} />
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
