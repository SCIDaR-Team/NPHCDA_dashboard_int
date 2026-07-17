import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Target as TargetIcon } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton, Card, Badge } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { TargetChip } from '@/components/dashboard/TargetChip';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore } from '@/store/filterStore';
import { useNotificationStore } from '@/store/notificationStore';
import { facilityMeasures, goodnessFor, statusFor, heatColor, looksLikePercent } from '@/data/calculations';
import { parseFacilityKey } from '@/data/scopedEngine';
import { ZONE_OF_STATE, STATE_DONORS } from '@/data/geo/states';
import { cleanName, decodeHtml } from '@/lib/format';
import type { BlockName, Indicator, FacilityRow } from '@/data/types';

interface Measured {
  ind: Indicator;
  block: BlockName;
  display: string;
  pct: number;
  goodness: number;
  isPct: boolean;
}

export function FacilityProfilePage() {
  const { key = '' } = useParams();
  const facilityKey = decodeURIComponent(key);
  const { state, lga, facility } = parseFacilityKey(facilityKey);

  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const { data: facilities } = useAsync(() => ds.getFacilities());
  const navigate = useNavigate();
  const setFilter = useFilterStore((s) => s.set);
  const toast = useNotificationStore((s) => s.toast);

  // Roster identity row (assessed universe), if this facility is in it.
  const roster: FacilityRow | undefined = useMemo(
    () => (facilities ?? []).find((r) => `${r.state}|${r.lga}|${r.facility}` === facilityKey),
    [facilities, facilityKey]
  );

  // Every per-facility indicator measurement for this facility, grouped by block.
  const measured = useMemo<Measured[]>(() => {
    if (!blocks) return [];
    const out: Measured[] = [];
    for (const bn of Object.keys(blocks) as BlockName[]) {
      for (const ind of blocks[bn]) {
        const m = facilityMeasures(ind.name)[facilityKey];
        if (!m) continue;
        const display = decodeHtml(m.value);
        out.push({
          ind,
          block: bn,
          display,
          pct: m.pct,
          goodness: goodnessFor({ inverse: ind.inverse, pct: m.pct }),
          isPct: looksLikePercent(display),
        });
      }
    }
    return out;
  }, [blocks, facilityKey]);

  // Facility readiness index: mean goodness of the measured percentage indicators
  // (counts/rates without a 0–100 scale are excluded so the index stays comparable).
  const index = useMemo(() => {
    const g = measured.filter((m) => m.isPct).map((m) => m.goodness);
    return g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length) : null;
  }, [measured]);

  const donors = STATE_DONORS[state] ?? [];

  const scopeToFacility = () => {
    setFilter({ state, zone: ZONE_OF_STATE[state], lga, facility, ward: '' });
    toast({ tone: 'info', title: `Scoped to ${facility}`, description: 'All pages now reflect this facility.' });
    navigate('/app/overview');
  };

  const exportRows = useMemo(
    () =>
      measured.map((m) => ({
        Indicator: cleanName(m.ind.name),
        Block: m.block,
        Value: m.display,
        'Performance (0–100)': m.goodness,
      })),
    [measured]
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!facility) return <ErrorState message="No facility specified." onRetry={() => navigate('/app/facilities')} />;

  const byBlock = (bn: BlockName) => measured.filter((m) => m.block === bn);

  return (
    <div>
      <PageHeader
        title={facility}
        subtitle={
          <span className="flex items-center gap-1.5">
            <MapPin size={13} className="text-muted-2" />
            {state} › {lga}
            {roster?.ward ? ` › ${roster.ward}` : ''}
          </span>
        }
        actions={
          measured.length ? (
            <ExportMenu filename={`nphcda-facility-${facility.toLowerCase().replace(/\s+/g, '-')}`} rows={exportRows} />
          ) : undefined
        }
      />

      <Link
        to="/app/facilities"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand-bright"
      >
        <ArrowLeft size={15} /> Back to Facility Deepdive
      </Link>

      {/* Identity + readiness index band. */}
      <Card className="mb-5 p-5">
        {loading ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 flex-col items-center justify-center rounded-xl text-white shadow-sm"
                style={{ background: index != null ? heatColor(index) : 'var(--bg-elev-3, #6b7280)' }}
              >
                <span className="text-2xl font-extrabold tabular-nums leading-none">{index != null ? index : '—'}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">Index</span>
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-muted-2">Facility readiness index</div>
                <div className="mt-0.5 max-w-xs text-[12px] leading-snug text-muted">
                  Mean performance across the {measured.filter((m) => m.isPct).length} percentage indicators measured here.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {roster?.type && <Badge tone={roster.type === 'CEmONC' ? 'info' : 'neutral'}>{roster.type}</Badge>}
              {roster?.status && (
                <Badge tone={roster.status === 'L2' || roster.status === 'L1' ? 'good' : roster.status === 'Partial' ? 'mid' : 'poor'}>
                  {roster.status}
                </Badge>
              )}
              {donors.length ? (
                donors.map((d) => (
                  <span key={d} className="rounded-full bg-brand/12 px-2 py-0.5 text-[12px] font-semibold text-brand-bright">
                    {d}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-bg-elev-3 px-2 py-0.5 text-[12px] font-semibold text-muted">No mapped donor</span>
              )}
            </div>

            <button
              onClick={scopeToFacility}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-bright"
            >
              <TargetIcon size={13} /> Scope dashboard here
            </button>
          </div>
        )}
      </Card>

      {loading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !measured.length ? (
        <Card className="px-4 py-10 text-center text-sm text-muted">
          No per-facility indicator measurements for this facility. It may report only through PFMO (see the National PHC
          registry in{' '}
          <Link to="/app/facilities" className="font-semibold text-brand-bright hover:underline">
            Facility Deepdive
          </Link>
          ).
        </Card>
      ) : (
        (['Facility Readiness', 'Stock Status', 'Service Delivery'] as BlockName[]).map((bn) => {
          const rows = byBlock(bn);
          if (!rows.length) return null;
          return (
            <SectionBlock key={bn} title={bn}>
              <div className="grid gap-3 sm:grid-cols-2">
                {rows.map((m) => (
                  <div key={m.ind.name} className="rounded-lg border border-border bg-bg-elev-2/40 px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-text">{cleanName(m.ind.name)}</span>
                      {m.isPct && m.pct > 0 && (
                        <Badge tone={statusFor(m.pct, m.ind.inverse).level} className="flex-shrink-0">
                          {statusFor(m.pct, m.ind.inverse).label}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-lg font-extrabold tabular-nums" style={{ color: heatColor(m.goodness) }}>
                        {m.display}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elev-3" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(m.goodness, 3)}%`, background: heatColor(m.goodness) }} />
                      </span>
                    </div>
                    {m.isPct && (
                      <div className="mt-2">
                        <TargetChip indicatorName={m.ind.name} actualPct={m.pct} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionBlock>
          );
        })
      )}
    </div>
  );
}
