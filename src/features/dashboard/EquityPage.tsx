import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton, Card } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { stateCompositeScore } from '@/components/map/stateProfile';
import { ALL_STATES, ZONE_STATES, ZONE_OF_STATE, STATE_DONORS } from '@/data/geo/states';
import { stateMeasures, goodnessFor, heatColor } from '@/data/calculations';
import { gradeableByBlock, BLOCK_NAMES } from '@/data/scorecard';
import { groupMeans, equityGap, type GroupStat } from '@/data/equity';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Indicator } from '@/data/types';

const ZONE_ORDER = Object.keys(ZONE_STATES);

export function EquityPage() {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const [metric, setMetric] = useState<'composite' | string>('composite');

  const indByName = useMemo(() => {
    const m: Record<string, Indicator> = {};
    if (blocks) Object.values(blocks).forEach((list) => list.forEach((i) => (m[i.name] = i)));
    return m;
  }, [blocks]);

  // Per-state 0–100 goodness for the selected metric (measured states only).
  const values = useMemo<Record<string, number>>(() => {
    if (!blocks) return {};
    const out: Record<string, number> = {};
    if (metric === 'composite') {
      ALL_STATES.forEach((st) => {
        const v = stateCompositeScore(st, indByName);
        if (v != null) out[st] = v;
      });
    } else {
      const ind = indByName[metric];
      const measures = ind ? stateMeasures(metric) : {};
      ALL_STATES.forEach((st) => {
        const m = measures[st];
        if (m) out[st] = goodnessFor({ inverse: ind.inverse, pct: m.pct });
      });
    }
    return out;
  }, [blocks, metric, indByName]);

  const byZone = useMemo(() => groupMeans(values, (s) => ZONE_OF_STATE[s], ZONE_ORDER), [values]);
  const byDonor = useMemo(
    () => groupMeans(values, (s) => (STATE_DONORS[s]?.length ? 'Donor-supported' : 'Non-donor'), ['Donor-supported', 'Non-donor']),
    [values]
  );
  const zoneGap = equityGap(byZone);
  const donorGap = equityGap(byDonor);

  const exportRows = useMemo(
    () => [
      ...byZone.map((g) => ({ Stratum: 'Zone', Group: g.group, 'Mean (0–100)': g.mean ?? '', States: g.n })),
      ...byDonor.map((g) => ({ Stratum: 'Donor', Group: g.group, 'Mean (0–100)': g.mean ?? '', States: g.n })),
    ],
    [byZone, byDonor]
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;

  const metricLabel = metric === 'composite' ? 'Composite performance' : cleanName(metric);

  return (
    <div>
      <PageHeader
        title="Equity analysis"
        subtitle="Compare performance across equity strata — geopolitical zone and donor support — to surface who is being left behind. Each group's figure is the mean per-state performance (0–100) of its measured states."
        actions={<ExportMenu filename="nphcda-equity" rows={exportRows} />}
      />

      <SectionBlock
        title="Metric"
        action={
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            aria-label="Metric to analyse equity for"
            className="h-9 max-w-[300px] rounded-lg border border-border bg-bg-elev px-2.5 text-sm font-semibold text-text focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <option value="composite">Composite performance</option>
            {blocks &&
              BLOCK_NAMES.map((bn) => (
                <optgroup key={bn} label={bn}>
                  {gradeableByBlock(blocks)[bn].map((ind) => (
                    <option key={ind.name} value={ind.name}>
                      {cleanName(ind.name)}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        }
      >
        <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-muted-2" />
          <span>
            Showing <span className="font-semibold text-text-soft">{metricLabel}</span>. Rural/urban stratification isn't
            carried by any current source, so it isn't shown — only real strata are compared.
          </span>
        </p>
      </SectionBlock>

      <div className="grid gap-5 lg:grid-cols-2">
        <EquityGroup title="By geopolitical zone" stats={byZone} gap={zoneGap} loading={loading} metricLabel={metricLabel} />
        <EquityGroup title="Donor-supported vs non-donor" stats={byDonor} gap={donorGap} loading={loading} metricLabel={metricLabel} />
      </div>
    </div>
  );
}

function EquityGroup({
  title,
  stats,
  gap,
  loading,
  metricLabel,
}: {
  title: string;
  stats: GroupStat[];
  gap: number | null;
  loading: boolean;
  metricLabel: string;
}) {
  const measured = stats.filter((s) => s.mean != null);
  const max = Math.max(100, ...measured.map((s) => s.mean as number));
  return (
    <SectionBlock title={title}>
      {loading ? (
        <Skeleton className="h-56 rounded-card" />
      ) : !measured.length ? (
        <Card className="px-4 py-8 text-center text-sm text-muted">No measured states for {metricLabel}.</Card>
      ) : (
        <div>
          {gap != null && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-bg-elev-2/50 px-3.5 py-2.5">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">Equity gap</span>
              <span className="text-lg font-extrabold tabular-nums text-text">{gap}</span>
              <span className="text-[12px] text-muted">points between best and worst group</span>
            </div>
          )}
          <div className="space-y-2.5">
            {stats.map((s) => (
              <div key={s.group} className="flex items-center gap-3">
                <span className="w-28 flex-shrink-0 truncate text-[13px] font-medium text-text" title={s.group}>
                  {s.group}
                </span>
                <div className="flex-1">
                  {s.mean != null ? (
                    <div className="flex items-center gap-2">
                      <span className="h-3 overflow-hidden rounded-full bg-bg-elev-3" style={{ width: `${(s.mean / max) * 100}%`, minWidth: 4 }}>
                        <span className="block h-full rounded-full" style={{ background: heatColor(s.mean) }} />
                      </span>
                      <span className="font-semibold tabular-nums" style={{ color: heatColor(s.mean) }}>
                        {Math.round(s.mean)}
                      </span>
                      <span className="text-[11px] text-muted-2">· {s.n} state{s.n === 1 ? '' : 's'}</span>
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted-2">No measured states</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Best / worst detail per group. */}
          <div className="mt-4 overflow-hidden rounded-lg border border-border-soft">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-elev-2 text-left text-[11px] uppercase tracking-wide text-muted-2">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Group</th>
                  <th className="px-3 py-1.5 font-semibold">Strongest</th>
                  <th className="px-3 py-1.5 font-semibold">Weakest</th>
                </tr>
              </thead>
              <tbody>
                {measured.map((s) => (
                  <tr key={s.group} className="border-t border-border-soft">
                    <td className="px-3 py-1.5 font-medium text-text">{s.group}</td>
                    <td className={cn('px-3 py-1.5 text-text-soft')}>
                      {s.best ? `${s.best.state} (${Math.round(s.best.value)})` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-text-soft">
                      {s.worst ? `${s.worst.state} (${Math.round(s.worst.value)})` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionBlock>
  );
}
