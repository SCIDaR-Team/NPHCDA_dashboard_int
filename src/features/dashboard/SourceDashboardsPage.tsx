import { PageHeader } from '@/components/dashboard/PageHeader';
import { SourceDashboards } from '@/components/dashboard/SourceDashboards';
import { SectionBlock, Skeleton } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { formatDate, relativeTime } from '@/lib/freshness';
import { Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export function SourceDashboardsPage() {
  const ds = getDataSource();
  const { data: meta, loading } = useAsync(() => ds.getSnapshotMeta());

  return (
    <div>
      <PageHeader
        title="Detailed Source Dashboards"
        subtitle="The central access point for every linked source dashboard feeding this platform. Each card opens the underlying system in a new tab."
      />

      {/* Data lineage & freshness — the real per-source fetch status recorded by the
          ETL in the snapshot header, plus when the snapshot itself was generated. */}
      {loading ? (
        <Skeleton className="mb-5 h-40 rounded-card" />
      ) : meta ? (
        <SectionBlock
          title="Data freshness & source status"
          action={
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <Clock size={14} className="text-muted-2" />
              Data as of <span className="font-semibold text-text-soft">{formatDate(meta.generatedAt)}</span>
              <span className="text-muted-2">· {relativeTime(meta.generatedAt)}</span>
            </span>
          }
        >
          {(meta.period?.from || meta.period?.to) && (
            <p className="mb-3 text-[12.5px] text-muted">
              Reporting period covered:{' '}
              <span className="font-semibold text-text-soft">
                {meta.period.from ?? '—'} → {meta.period.to ?? '—'}
              </span>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meta.sources.map((s) => (
              <div key={s.name} className="rounded-lg border border-border bg-bg-elev-2/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-text">{s.name}</span>
                  {s.ok ? (
                    <span className="flex flex-shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-bright">
                      <CheckCircle2 size={13} /> Live
                    </span>
                  ) : (
                    <span className="flex flex-shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-danger">
                      <AlertTriangle size={13} /> Failed
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted">
                  <span>
                    <span className="font-semibold text-text-soft">{s.rowsFetched.toLocaleString('en-US')}</span> rows
                  </span>
                  {s.facilities > 0 && (
                    <span>
                      <span className="font-semibold text-text-soft">{s.facilities.toLocaleString('en-US')}</span>{' '}
                      facilities
                    </span>
                  )}
                </div>
                {!s.ok && s.error && (
                  <p className="mt-1.5 truncate text-[11px] text-danger" title={s.error}>
                    {s.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      <SourceDashboards />
    </div>
  );
}
