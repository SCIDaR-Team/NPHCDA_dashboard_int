import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Database, Clock } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton, Card } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { heatColor } from '@/data/calculations';
import { indicatorQualities, qualitySummary, type IndicatorQuality } from '@/data/dataQuality';
import { formatDate, relativeTime } from '@/lib/freshness';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { BlockName } from '@/data/types';

type SortKey = 'name' | 'completeness' | 'smallN' | 'outliers';

export function DataQualityPage() {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const { data: meta } = useAsync(() => ds.getSnapshotMeta());

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'completeness', dir: 'asc' });

  const rows = useMemo<IndicatorQuality[]>(() => (blocks ? indicatorQualities(blocks) : []), [blocks]);
  const summary = useMemo(() => qualitySummary(rows), [rows]);
  const measured = useMemo(() => rows.filter((r) => r.hasSource), [rows]);
  const missing = useMemo(() => rows.filter((r) => !r.hasSource), [rows]);

  const sortedMeasured = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const valueOf = (r: IndicatorQuality): number =>
      sort.key === 'completeness'
        ? r.completeness ?? -1
        : sort.key === 'smallN'
          ? r.smallNStates
          : sort.key === 'outliers'
            ? r.outlierStates.length
            : 0;
    return [...measured].sort((a, b) =>
      sort.key === 'name' ? a.name.localeCompare(b.name) * dir : (valueOf(a) - valueOf(b)) * dir || a.name.localeCompare(b.name)
    );
  }, [measured, sort]);

  const exportRows = useMemo(
    () =>
      rows.map((r) => ({
        Indicator: cleanName(r.name),
        Block: r.block,
        'Has source': r.hasSource ? 'Yes' : 'No',
        'States measured': r.measuredStates,
        'States expected': r.expectedStates,
        'Completeness %': r.completeness ?? '',
        'Small-sample states': r.smallNStates,
        Outliers: r.outlierStates.length,
      })),
    [rows]
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Data quality"
        subtitle="Completeness, timeliness, missing data, small samples and outliers — computed from the same real measurements the rest of the platform uses."
        actions={<ExportMenu filename="nphcda-data-quality" rows={exportRows} />}
      />

      {/* Headline quality KPIs. */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QualityKpi
          icon={<Database size={16} />}
          label="Indicators with a live source"
          value={loading ? null : `${summary.withSource}/${summary.totalIndicators}`}
          sub={`${summary.missing} not yet sourced`}
        />
        <QualityKpi
          icon={<CheckCircle2 size={16} />}
          label="Mean state completeness"
          value={loading ? null : summary.meanCompleteness != null ? `${Math.round(summary.meanCompleteness)}%` : '—'}
          sub="Across sourced indicators"
          score={summary.meanCompleteness ?? undefined}
        />
        <QualityKpi
          icon={<AlertTriangle size={16} />}
          label="Small-sample flags"
          value={loading ? null : String(summary.smallNFlags)}
          sub="State figures below the reliability threshold"
        />
        <QualityKpi
          icon={<AlertTriangle size={16} />}
          label="Outlier flags"
          value={loading ? null : String(summary.outlierFlags)}
          sub="States outside the 1.5×IQR fence"
        />
      </div>

      {/* Timeliness / per-source freshness. */}
      <SectionBlock title="Source timeliness & freshness">
        {!meta ? (
          <Skeleton className="h-24 rounded-card" />
        ) : (
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-[12.5px] text-muted">
              <Clock size={14} className="flex-shrink-0 text-muted-2" />
              Snapshot generated <span className="font-semibold text-text-soft">{formatDate(meta.generatedAt)}</span>
              {relativeTime(meta.generatedAt) && <span>· {relativeTime(meta.generatedAt)}</span>}
              {meta.period?.from && meta.period?.to && (
                <span>
                  · covering {meta.period.from} → {meta.period.to}
                </span>
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {meta.sources.map((s) => (
                <div key={s.name} className="flex items-start gap-2.5 rounded-lg border border-border bg-bg-elev-2/50 px-3.5 py-3">
                  {s.ok ? (
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-[#2e8b57]" />
                  ) : (
                    <XCircle size={16} className="mt-0.5 flex-shrink-0 text-[#c2562c]" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text">{s.name}</div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {s.ok ? (
                        <>
                          {s.rowsFetched.toLocaleString()} rows · {s.facilities.toLocaleString()} facilities
                        </>
                      ) : (
                        <span className="text-[#c2562c]">{s.error ?? 'Fetch failed'}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionBlock>

      {/* Completeness + reliability table. */}
      <SectionBlock title="Indicator completeness & reliability">
        <p className="mb-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-muted-2" />
          <span>
            Completeness is the share of an indicator's expected states that carry a real measurement. Small-sample and
            outlier counts flag figures to interpret with care.
          </span>
        </p>
        {loading ? (
          <Skeleton className="h-80 rounded-card" />
        ) : (
          <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-bg-elev-2 text-left text-xs text-muted">
                <tr>
                  <SortTh label="Indicator" k="name" sort={sort} onSort={toggleSort} />
                  <th scope="col" className="px-3 py-2.5 font-semibold">Block</th>
                  <SortTh label="Completeness" k="completeness" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label="Small n" k="smallN" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label="Outliers" k="outliers" sort={sort} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedMeasured.map((r) => (
                  <tr key={r.name} className="border-t border-border-soft hover:bg-bg-elev-2/50">
                    <td className="px-3 py-2 font-medium text-text">{cleanName(r.name)}</td>
                    <td className="px-3 py-2 text-muted">{blockShort(r.block)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {r.completeness != null ? (
                          <>
                            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-bg-elev-3 sm:block" aria-hidden>
                              <span className="block h-full rounded-full" style={{ width: `${Math.max(r.completeness, 3)}%`, background: heatColor(r.completeness) }} />
                            </span>
                            <span className="w-24 text-right tabular-nums text-text-soft">
                              {r.measuredStates}/{r.expectedStates}
                              <span className="ml-1 font-semibold" style={{ color: heatColor(r.completeness) }}>
                                {Math.round(r.completeness)}%
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className="text-xs italic text-muted-2">n/a</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <FlagCount count={r.smallNStates} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <FlagCount
                        count={r.outlierStates.length}
                        title={r.outlierStates.map((o) => `${o.state} (${o.value}, ${o.bound})`).join(', ')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>

      {/* Missing data — indicators with no live source yet. */}
      <SectionBlock title={`Data gaps${missing.length ? ` (${missing.length})` : ''}`} tone="warning">
        {loading ? (
          <Skeleton className="h-20 rounded-card" />
        ) : !missing.length ? (
          <Card className="px-4 py-6 text-center text-sm text-muted">Every catalogued indicator has a live source.</Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missing.map((r) => (
              <div key={r.name} className="rounded-lg border border-dashed border-border bg-bg-elev-2/40 px-3 py-2.5">
                <div className="text-[13px] font-semibold text-text">{cleanName(r.name)}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-2">{blockShort(r.block)} · Tier {r.tier}</div>
              </div>
            ))}
          </div>
        )}
      </SectionBlock>
    </div>
  );
}

function blockShort(bn: BlockName): string {
  return bn === 'Facility Readiness' ? 'Readiness' : bn === 'Stock Status' ? 'Stock' : 'Service';
}

function FlagCount({ count, title }: { count: number; title?: string }) {
  if (!count) return <span className="tabular-nums text-muted-2">0</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[#c2562c]/12 px-2 py-0.5 font-semibold tabular-nums text-[#c2562c]"
      title={title}
    >
      {count}
    </span>
  );
}

function QualityKpi({
  icon,
  label,
  value,
  sub,
  score,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  sub: string;
  score?: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted">
        <span className="text-muted-2">{icon}</span>
        <span className="text-[12px] font-semibold">{label}</span>
      </div>
      {value == null ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className="mt-1.5 text-2xl font-extrabold tabular-nums" style={score != null ? { color: heatColor(score) } : undefined}>
          {value}
        </div>
      )}
      <div className="mt-0.5 text-[11px] text-muted-2">{sub}</div>
    </Card>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2.5 font-semibold', align === 'right' && 'text-right')}
    >
      <button
        onClick={() => onSort(k)}
        aria-label={`Sort by ${label}`}
        className={cn('inline-flex items-center gap-1 rounded hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60', align === 'right' && 'flex-row-reverse')}
      >
        {label}
        <span className={cn('text-[10px]', !active && 'opacity-40')}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}
