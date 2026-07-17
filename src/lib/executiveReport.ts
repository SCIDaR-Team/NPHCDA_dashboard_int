/**
 * Executive PDF report generator.
 *
 * Produces a structured, multi-section national briefing straight from the shared
 * engines (scorecard, targets, data-quality) — text + tables via jsPDF/autotable, not
 * screenshots, so it is crisp, small and reproducible. Everything printed is real
 * measured data or a clearly-labelled policy target; nothing is fabricated.
 */
import type { CellHookData } from 'jspdf-autotable';
import type { Blocks, SnapshotMeta } from '@/data/types';
import {
  nationalScorecardRow,
  scorecardRows,
  BLOCK_NAMES,
  BLOCK_SHORT,
} from '@/data/scorecard';
import { NATIONAL_TARGETS, varianceFor } from '@/data/targets';
import { indicatorQualities, qualitySummary } from '@/data/dataQuality';
import { ALL_STATES } from '@/data/geo/states';
import { cleanName } from '@/lib/format';
import { formatDate } from '@/lib/freshness';

const BRAND: [number, number, number] = [16, 94, 74]; // deep green header
const MUTED: [number, number, number] = [110, 120, 130];

export async function generateExecutiveReport(blocks: Blocks, meta: SnapshotMeta | null): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 40;
  const generatedNow = new Date();

  // ---- Title band ----------------------------------------------------------
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, pageW, 84, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('NPHCDA PHC Intelligence — Executive Report', margin, 40);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(
    `Generated ${formatDate(generatedNow.toISOString())}` +
      (meta?.generatedAt ? `  ·  Data snapshot: ${formatDate(meta.generatedAt)}` : '') +
      (meta?.period?.from && meta?.period?.to ? `  ·  Period ${meta.period.from} – ${meta.period.to}` : ''),
    margin,
    62
  );

  let y = 108;
  const heading = (text: string): void => {
    pdf.setTextColor(...BRAND);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(text, margin, y);
    y += 8;
  };
  const afterTable = (): number => (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ---- National grade ------------------------------------------------------
  const national = nationalScorecardRow(blocks);
  heading('National performance');
  autoTable(pdf, {
    startY: y + 6,
    head: [['Composite', 'Grade', ...BLOCK_NAMES.map((bn) => BLOCK_SHORT[bn])]],
    body: [[
      national.overall != null ? `${Math.round(national.overall)}/100` : '—',
      national.grade ?? '—',
      ...BLOCK_NAMES.map((bn) => (national.blocks[bn].score != null ? String(Math.round(national.blocks[bn].score!)) : '—')),
    ]],
    theme: 'grid',
    headStyles: { fillColor: BRAND, fontSize: 9 },
    bodyStyles: { fontSize: 11, fontStyle: 'bold' },
    margin: { left: margin, right: margin },
  });
  y = afterTable() + 24;

  // ---- Data quality --------------------------------------------------------
  const quality = qualitySummary(indicatorQualities(blocks));
  heading('Data quality & coverage');
  autoTable(pdf, {
    startY: y + 6,
    head: [['Indicators sourced', 'Mean completeness', 'Small-sample flags', 'Outlier flags', 'Data gaps']],
    body: [[
      `${quality.withSource}/${quality.totalIndicators}`,
      quality.meanCompleteness != null ? `${Math.round(quality.meanCompleteness)}%` : '—',
      String(quality.smallNFlags),
      String(quality.outlierFlags),
      String(quality.missing),
    ]],
    theme: 'grid',
    headStyles: { fillColor: BRAND, fontSize: 9 },
    bodyStyles: { fontSize: 10 },
    margin: { left: margin, right: margin },
  });
  y = afterTable() + 24;

  // ---- Best & weakest states (composite) -----------------------------------
  const ranked = scorecardRows(blocks, 'state', ALL_STATES)
    .filter((r) => r.overall != null)
    .sort((a, b) => (b.overall as number) - (a.overall as number));
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(-5).reverse();
  heading('Best & weakest states (composite)');
  autoTable(pdf, {
    startY: y + 6,
    head: [['Rank', 'Strongest states', 'Score', 'Grade', 'Weakest states', 'Score', 'Grade']],
    body: top.map((r, i) => {
      const b = bottom[i];
      return [
        String(i + 1),
        r.label,
        String(Math.round(r.overall as number)),
        r.grade ?? '—',
        b?.label ?? '',
        b ? String(Math.round(b.overall as number)) : '',
        b?.grade ?? '',
      ];
    }),
    theme: 'striped',
    headStyles: { fillColor: BRAND, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });
  y = afterTable() + 24;

  // ---- Key indicators vs national targets ----------------------------------
  const byName = Object.fromEntries(Object.values(blocks).flat().map((i) => [i.name, i]));
  const varianceRows = Object.keys(NATIONAL_TARGETS)
    .map((name) => {
      const ind = byName[name];
      const v = ind ? varianceFor(name, ind.pct) : null;
      return v ? { name, ...v } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => a.delta - b.delta);
  if (varianceRows.length) {
    heading('Key indicators vs national targets');
    autoTable(pdf, {
      startY: y + 6,
      head: [['Indicator', 'Actual', 'Target', 'Variance (pts)']],
      body: varianceRows.map((r) => [
        cleanName(r.name),
        `${Math.round(r.actual)}%`,
        `${r.target}%`,
        `${r.delta > 0 ? '+' : ''}${r.delta}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: BRAND, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 300 } },
      margin: { left: margin, right: margin },
      // Colour the variance cell green (met) / red (below target).
      didParseCell: (data: CellHookData) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = parseFloat(String(data.cell.raw));
          data.cell.styles.textColor = val >= 0 ? [46, 139, 87] : [194, 86, 44];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = afterTable() + 24;
  }

  // ---- Footer with provenance + page numbers -------------------------------
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    const h = pdf.internal.pageSize.getHeight();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(
      'Real measured data unless marked as a national target (policy benchmark). NPHCDA PHC Intelligence Platform.',
      margin,
      h - 20
    );
    pdf.text(`Page ${p} of ${pages}`, pageW - margin, h - 20, { align: 'right' });
  }

  pdf.save('nphcda-executive-report.pdf');
}
