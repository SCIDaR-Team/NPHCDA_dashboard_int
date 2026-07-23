import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { getDataSource } from '@/data/datasource';
import { useNotificationStore } from '@/store/notificationStore';
import { generateExecutiveReport } from '@/lib/executiveReport';

/**
 * One-click executive PDF. Pulls the (already-cached) blocks, KPI cards, trends and
 * snapshot metadata and hands them to the report generator, which builds a National,
 * summary-density model — the same model the Report Builder page produces, just
 * pre-scoped and condensed. The heavy jsPDF/autotable code is dynamically imported
 * inside the generator, so this button adds nothing to the initial bundle.
 */
export function ExecutiveReportButton({ className = '' }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useNotificationStore((s) => s.toast);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ds = getDataSource();
      const [blocks, meta, kpiGroups, trends] = await Promise.all([
        ds.getBlocks(),
        ds.getSnapshotMeta(),
        ds.getKpiGroups(),
        ds.getTrendSeries(),
      ]);
      await generateExecutiveReport(blocks, meta, kpiGroups, trends);
      toast({ tone: 'success', title: 'Executive report downloaded', description: 'nphcda-executive-report.pdf' });
    } catch {
      toast({ tone: 'error', title: 'Could not build the report', description: 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy}
      className={`flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-elev px-3 text-sm font-semibold text-text transition-colors hover:border-brand/50 hover:text-brand-bright focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
      Executive PDF
    </button>
  );
}
