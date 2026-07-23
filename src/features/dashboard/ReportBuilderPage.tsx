import { useMemo, useState } from 'react';
import { FileText, FileType2, Loader2, RotateCcw, Filter } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card, Select, FieldLabel, Button, Skeleton, ErrorState } from '@/components/ui';
import { ExecutiveReportDoc, REPORT_WIDTH } from '@/components/dashboard/ExecutiveReportDoc';
import { getDataSource } from '@/data/datasource';
import { useAsync } from '@/hooks/useAsync';
import { useFilterStore, EMPTY_FILTER, pickFilter } from '@/store/filterStore';
import { useSnapshotStore } from '@/store/snapshotStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ZONE_OF_STATE } from '@/data/geo/states';
import { buildReportModel, type ReportDensity, type ReportModel } from '@/data/reportModel';
import { renderReportModelPdf } from '@/lib/executiveReport';
import { renderReportModelWord } from '@/lib/reportWord';
import type { FilterState } from '@/data/types';

const toOpts = (vals: string[], placeholder: string) => [
  { value: '', label: placeholder },
  ...vals.map((v) => ({ value: v, label: v })),
];
const distinct = (vals: (string | undefined | null)[]) =>
  Array.from(new Set(vals.filter((v): v is string => !!v))).sort();

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ReportBuilderPage() {
  const ds = getDataSource();
  const { data, loading, error, reload } = useAsync(() =>
    Promise.all([ds.getBlocks(), ds.getKpiGroups(), ds.getTrendSeries(), ds.getSnapshotMeta(), ds.getFacilities()])
  );
  const facts = useSnapshotStore((s) => s.facts);
  const liveFilter = useFilterStore(pickFilter);
  const toast = useNotificationStore((s) => s.toast);

  const [draft, setDraft] = useState<FilterState>({ ...EMPTY_FILTER });
  const [density, setDensity] = useState<ReportDensity>('full');
  const [busy, setBusy] = useState<'' | 'pdf' | 'word'>('');

  const [blocks, kpiGroups, trends, meta, facilities] = data ?? [null, null, null, null, null];

  // Scope option lists, derived from the roster + MAMII geography (mirrors FilterDrawer).
  const geo = useMemo(() => {
    const roster = (facilities ?? []).map((f) => ({ state: f.state, zone: f.zone, donor: f.donor, lga: f.lga, type: f.type as string | null }));
    const mamii = (facts?.mamii ?? []).map((r) => ({ state: r.state, zone: r.zone, donor: r.donor, lga: r.lga, type: null as string | null }));
    return [...roster, ...mamii];
  }, [facilities, facts]);

  const zoneOpts = useMemo(() => distinct(geo.map((f) => f.zone)), [geo]);
  const donorOpts = useMemo(() => distinct(geo.flatMap((f) => f.donor ?? [])), [geo]);
  const typeOpts = useMemo(() => distinct(geo.map((f) => f.type)), [geo]);
  const stateOpts = useMemo(
    () => distinct((draft.zone ? geo.filter((f) => f.zone === draft.zone) : geo).map((f) => f.state)),
    [geo, draft.zone]
  );
  const lgaOpts = useMemo(
    () => (draft.state ? distinct(geo.filter((f) => f.state === draft.state).map((f) => f.lga)) : []),
    [geo, draft.state]
  );

  const set = (patch: Partial<FilterState>) => setDraft((d) => ({ ...d, ...patch }));

  const model = useMemo<ReportModel | null>(() => {
    if (!blocks || !kpiGroups) return null;
    return buildReportModel({ blocks, kpiGroups, trends, meta, filter: draft, density });
    // facts drives the scoped engine — recompute when it loads / the scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, kpiGroups, trends, meta, draft, density, facts]);

  const useDashboardScope = () => setDraft({ ...liveFilter });
  const resetScope = () => setDraft({ ...EMPTY_FILTER });

  const download = async (kind: 'pdf' | 'word') => {
    if (!model || busy) return;
    setBusy(kind);
    try {
      if (kind === 'pdf') await renderReportModelPdf(model);
      else renderReportModelWord(model);
      toast({ tone: 'success', title: 'Report downloaded', description: `nphcda-executive-report.${kind === 'pdf' ? 'pdf' : 'doc'}` });
    } catch {
      toast({ tone: 'error', title: 'Could not build the report', description: 'Please try again.' });
    } finally {
      setBusy('');
    }
  };

  if (error) return <ErrorState message="Could not load the report data." onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Report Builder"
        subtitle="Generate a high-level executive briefing — written analysis, charts and tables — for any scope. Set the scope, preview it live, then download the PDF."
        actions={
          <>
            <Button variant="secondary" onClick={() => download('word')} disabled={!!busy || !model}>
              {busy === 'word' ? <Loader2 size={15} className="animate-spin" /> : <FileType2 size={15} />}
              Word
            </Button>
            <Button variant="primary" onClick={() => download('pdf')} disabled={!!busy || !model}>
              {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              Download PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ---- Left: scope + density ---------------------------------- */}
        <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-text"><Filter size={14} /> Scope</h2>
              <button onClick={useDashboardScope} className="text-xs font-semibold text-brand-bright hover:underline">
                Use dashboard filters
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Zone</FieldLabel>
                  <Select value={draft.zone} onChange={(e) => set({ zone: e.target.value, state: '', lga: '', facility: '' })} options={toOpts(zoneOpts, 'All zones')} />
                </div>
                <div>
                  <FieldLabel>State</FieldLabel>
                  <Select
                    value={draft.state}
                    onChange={(e) => set({ state: e.target.value, zone: e.target.value ? ZONE_OF_STATE[e.target.value] ?? draft.zone : draft.zone, lga: '', facility: '' })}
                    options={toOpts(stateOpts, 'All states')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>LGA</FieldLabel>
                  <Select value={draft.lga} onChange={(e) => set({ lga: e.target.value, facility: '' })} options={toOpts(lgaOpts, 'All LGAs')} disabled={!draft.state} />
                </div>
                <div>
                  <FieldLabel>Facility type</FieldLabel>
                  <Select value={draft.facilityType} onChange={(e) => set({ facilityType: e.target.value, facility: '' })} options={toOpts(typeOpts, 'All types')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Donor</FieldLabel>
                  <Select value={draft.donor} onChange={(e) => set({ donor: e.target.value })} options={toOpts(donorOpts, 'All donors')} />
                </div>
                <div>
                  <FieldLabel>Programme</FieldLabel>
                  <Select
                    value={draft.source}
                    onChange={(e) => set({ source: e.target.value })}
                    options={[
                      { value: '', label: 'All programmes' },
                      { value: 'SRH', label: 'SRH' },
                      { value: 'SFM', label: 'SFM' },
                      { value: 'MAMII', label: 'MAMII' },
                      { value: 'PFMO', label: 'PFMO' },
                    ]}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Year</FieldLabel>
                  <Select value={draft.year} onChange={(e) => set({ year: e.target.value })} options={toOpts(['2026', '2025'], 'All years')} />
                </div>
                <div>
                  <FieldLabel>Month</FieldLabel>
                  <Select value={draft.month} onChange={(e) => set({ month: e.target.value })} options={toOpts(MONTHS, 'All months')} />
                </div>
              </div>
              <button onClick={resetScope} className="flex items-center gap-2 text-xs font-semibold text-muted transition-colors hover:text-text">
                <RotateCcw size={13} /> Reset scope
              </button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-text">Detail</h2>
              <div className="flex rounded-lg border border-border p-0.5 text-xs font-semibold">
                {(['summary', 'full'] as ReportDensity[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={`rounded-md px-2.5 py-1 capitalize transition-colors ${density === d ? 'bg-brand text-white' : 'text-muted hover:text-text'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              <b className="text-text-soft">Summary</b> keeps the headline figures per section (matches the one-click Executive PDF). <b className="text-text-soft">Full</b> lists every measured indicator.
            </p>
          </Card>
        </div>

        {/* ---- Right: live document preview ---------------------------- */}
        <div className="min-w-0 overflow-x-auto rounded-card bg-bg-elev-2/50 p-4 sm:p-6">
          {model ? (
            <div className="mx-auto shadow-card" style={{ width: REPORT_WIDTH, maxWidth: '100%' }}>
              <ExecutiveReportDoc model={model} />
            </div>
          ) : (
            <div className="mx-auto space-y-4 bg-white p-8" style={{ width: REPORT_WIDTH, maxWidth: '100%' }}>
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              {loading && <span className="sr-only">Loading report…</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
