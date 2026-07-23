/**
 * Executive PDF exporter — NATIVE jsPDF rendering (no screenshots).
 *
 * Draws the shared ReportModel straight to vector: justified prose, vector charts
 * (score bars, target bars, sparklines, ranking bars) and autotable tables. This is
 * crisp, small, selectable and 100% reliable — unlike an html2canvas capture, whose
 * SVG charts rasterised poorly. Spacing is controlled explicitly so the document
 * breathes. Everything printed is real measured data or a clearly-labelled target.
 */
import type { CellHookData } from 'jspdf-autotable';
import type { Blocks, KpiGroup, SnapshotMeta, TrendSeries } from '@/data/types';
import { buildReportModel, type ReportModel, type ReportSection } from '@/data/reportModel';
import { EMPTY_FILTER } from '@/store/filterStore';
import { formatDate } from '@/lib/freshness';

type RGB = [number, number, number];
const BRAND: RGB = [15, 107, 82];
const BRAND_TINT: RGB = [232, 242, 238];
const INK: RGB = [27, 36, 48];
const MUTED: RGB = [107, 118, 134];
const TRACK: RGB = [236, 240, 244];
const GOOD: RGB = [46, 139, 87];
const BAD: RGB = [194, 86, 44];
const TARGET: RGB = [185, 146, 42];
const LINE: RGB = [225, 230, 236];

type Doc = import('jspdf').jsPDF;
type AutoTable = typeof import('jspdf-autotable').default;

interface Ctx {
  pdf: Doc;
  autoTable: AutoTable;
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
  y: number;
  sectionNo: number;
}

const bandColor = (v: number | null): RGB => (v == null ? MUTED : v >= 67 ? GOOD : v >= 34 ? TARGET : BAD);

/** Render a report model to a paginated A4 PDF and save it. */
export async function renderReportModelPdf(model: ReportModel, filename = 'nphcda-executive-report.pdf'): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 44;
  const ctx: Ctx = {
    pdf,
    autoTable,
    pageW: pdf.internal.pageSize.getWidth(),
    pageH: pdf.internal.pageSize.getHeight(),
    margin,
    contentW: pdf.internal.pageSize.getWidth() - margin * 2,
    y: 0,
    sectionNo: 0,
  };

  titleBand(ctx, model);
  for (const section of model.sections) if (section.enabled) renderSection(ctx, section);
  footer(ctx);

  pdf.save(filename);
}

/** One-click executive PDF: National scope, summary density, downloaded immediately. */
export async function generateExecutiveReport(
  blocks: Blocks,
  meta: SnapshotMeta | null,
  kpiGroups: KpiGroup[],
  trends: TrendSeries | null
): Promise<void> {
  const model = buildReportModel({ blocks, kpiGroups, trends, meta, filter: EMPTY_FILTER, density: 'summary' });
  await renderReportModelPdf(model);
}

/* ------------------------------------------------------------------ *
 * Primitives.
 * ------------------------------------------------------------------ */

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y + needed > ctx.pageH - 54) {
    ctx.pdf.addPage();
    ctx.y = 54;
  }
}

function titleBand(ctx: Ctx, model: ReportModel): void {
  const { pdf, pageW, margin } = ctx;
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, pageW, 96, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  pdf.text('NPHCDA PHC Intelligence — Executive Report', margin, 40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(`Scope: ${model.scopeLabel}`, margin, 62);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(232, 242, 238);
  pdf.text(
    `Generated ${formatDate(model.generatedAt)}` +
      (model.meta?.generatedAt ? `   ·   Data snapshot: ${formatDate(model.meta.generatedAt)}` : '') +
      (model.meta?.period?.from && model.meta?.period?.to ? `   ·   Period ${model.meta.period.from} – ${model.meta.period.to}` : ''),
    margin,
    80
  );
  ctx.y = 124;
}

function heading(ctx: Ctx, title: string): void {
  ensureSpace(ctx, 60);
  const { pdf, margin } = ctx;
  ctx.sectionNo += 1;
  // Numbered brand tab.
  pdf.setFillColor(...BRAND);
  pdf.roundedRect(margin, ctx.y - 11, 20, 16, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(String(ctx.sectionNo), margin + 10, ctx.y + 1, { align: 'center' });
  pdf.setTextColor(...BRAND);
  pdf.setFontSize(13.5);
  pdf.text(title, margin + 30, ctx.y + 1);
  ctx.y += 12;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.6);
  pdf.line(margin, ctx.y, ctx.pageW - margin, ctx.y);
  ctx.y += 16;
}

/** Justified body paragraph (last line left-aligned so it doesn't stretch). */
function paragraph(ctx: Ctx, text: string): void {
  if (!text.trim()) return;
  const { pdf, margin, contentW } = ctx;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(...INK);
  const lines = pdf.splitTextToSize(text, contentW) as string[];
  const lineH = 15.5;
  lines.forEach((ln, i) => {
    ensureSpace(ctx, lineH);
    const isLast = i === lines.length - 1;
    pdf.text(ln, margin, ctx.y, isLast ? {} : { maxWidth: contentW, align: 'justify' });
    ctx.y += lineH;
  });
  ctx.y += 8;
}

function subLabel(ctx: Ctx, text: string): void {
  ensureSpace(ctx, 20);
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(...MUTED);
  ctx.pdf.text(text.toUpperCase(), ctx.margin, ctx.y);
  ctx.y += 12;
}

/** A labelled horizontal bar with an optional target tick. */
function bar(ctx: Ctx, opts: { label: string; pct: number; target?: number; met?: boolean; right?: string }): void {
  const { pdf, margin, contentW } = ctx;
  const rowH = 17;
  ensureSpace(ctx, rowH);
  const labelW = 210;
  const rightW = 96;
  const trackX = margin + labelW;
  const trackW = contentW - labelW - rightW;
  const barY = ctx.y - 8;
  // Label.
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...INK);
  pdf.text(trim(pdf, opts.label, labelW - 8), margin, ctx.y);
  // Track + fill.
  pdf.setFillColor(...TRACK);
  pdf.roundedRect(trackX, barY, trackW, 11, 2.5, 2.5, 'F');
  const w = Math.max(0, Math.min(100, opts.pct)) / 100 * trackW;
  pdf.setFillColor(...(opts.target != null ? (opts.met ? GOOD : BAD) : BRAND));
  if (w > 0) pdf.roundedRect(trackX, barY, w, 11, 2.5, 2.5, 'F');
  // Target tick.
  if (opts.target != null) {
    const tx = trackX + Math.min(100, opts.target) / 100 * trackW;
    pdf.setDrawColor(...TARGET);
    pdf.setLineWidth(1.4);
    pdf.line(tx, barY - 2, tx, barY + 13);
  }
  // Right value.
  if (opts.right) {
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(opts.right, margin + contentW, ctx.y, { align: 'right' });
  }
  ctx.y += rowH;
}

function trim(pdf: Doc, text: string, maxW: number): string {
  if (pdf.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && pdf.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
  return t + '…';
}

const afterTable = (pdf: Doc): number => (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

function varianceCell(data: CellHookData): void {
  if (data.section !== 'body') return;
  const raw = String(data.cell.raw).trim();
  if (!/^[+-]?\d/.test(raw)) return;
  data.cell.styles.textColor = parseFloat(raw) >= 0 ? GOOD : BAD;
  data.cell.styles.fontStyle = 'bold';
}

function measuredTable(ctx: Ctx, head: string[], body: (string | number)[][], varianceCol?: number, firstColW?: number): void {
  ctx.autoTable(ctx.pdf, {
    startY: ctx.y,
    head: [head],
    body,
    theme: 'striped',
    headStyles: { fillColor: BRAND, fontSize: 8.5, cellPadding: 5 },
    bodyStyles: { fontSize: 9, cellPadding: 5, textColor: INK },
    alternateRowStyles: { fillColor: [247, 249, 251] },
    margin: { left: ctx.margin, right: ctx.margin },
    columnStyles: firstColW ? { 0: { cellWidth: firstColW } } : {},
    didParseCell: (d: CellHookData) => varianceCol != null && d.column.index === varianceCol && varianceCell(d),
  });
  ctx.y = afterTable(ctx.pdf) + 10;
}

/* ------------------------------------------------------------------ *
 * Sections.
 * ------------------------------------------------------------------ */

const nf = (n: number): string => n.toLocaleString('en-US');

function renderSection(ctx: Ctx, s: ReportSection): void {
  heading(ctx, s.title);
  paragraph(ctx, s.narrative);

  if (s.kind === 'coverage' && s.coverage) {
    const c = s.coverage;
    statTiles(ctx, [
      { label: 'Live indicators', value: String(c.live), sub: `of ${c.total} prioritized` },
      { label: 'States', value: nf(c.states) },
      { label: 'LGAs', value: nf(c.lgas) },
      { label: 'Facilities', value: nf(c.facilities) },
    ]);
    subLabel(ctx, 'Prioritized indicators by theme');
    countChips(ctx, c.themes.map((t) => ({ label: t.name, value: t.indicators })));
    subLabel(ctx, 'Reporting programmes');
    measuredTable(
      ctx,
      ['Programme', 'Indicators fed', 'Records', 'Facilities reporting'],
      c.programmes.map((p) => [p.name, String(p.indicators), nf(p.records), nf(p.facilities)])
    );
    ctx.y += 12;
    return;
  }

  if (s.kind === 'grade' && s.grade) {
    scoreHeader(ctx, s.grade);
    const targeted = (s.kpis ?? []).filter((k) => k.target != null);
    if (targeted.length) {
      subLabel(ctx, 'Headline indicators vs national target');
      for (const k of targeted.slice(0, 8)) {
        bar(ctx, { label: k.label, pct: k.pct, target: k.target, met: (k.delta ?? 0) >= 0, right: `${Math.round(k.pct)}% · tgt ${k.target}%` });
      }
      ctx.y += 6;
    }
    if (s.kpis?.length) {
      measuredTable(
        ctx,
        ['Headline indicator', 'Value', 'Target', 'Var.'],
        s.kpis.map((k) => [k.label, k.value, k.target != null ? `${k.target}%` : '—', k.delta != null ? `${k.delta > 0 ? '+' : ''}${k.delta}` : '—']),
        3,
        ctx.contentW - 210
      );
    }
    ctx.y += 12;
    return;
  }

  if (s.kind === 'block' && s.block) {
    const targeted = s.block.rows.filter((r) => r.target != null);
    if (targeted.length) {
      for (const r of targeted.slice(0, 8)) {
        bar(ctx, { label: r.name, pct: r.pct, target: r.target, met: (r.delta ?? 0) >= 0, right: `${Math.round(r.pct)}% · tgt ${r.target}%` });
      }
      ctx.y += 6;
    }
    measuredTable(
      ctx,
      ['Indicator', 'Value', 'Target', 'Var.'],
      s.block.rows.map((r) => [r.name, r.value, r.target != null ? `${r.target}%` : '—', r.delta != null ? `${r.delta > 0 ? '+' : ''}${r.delta}` : '—']),
      3,
      ctx.contentW - 210
    );
    ctx.y += 12;
    return;
  }

}

/** A row of big-number stat tiles (coverage header). */
function statTiles(ctx: Ctx, tiles: { label: string; value: string; sub?: string }[]): void {
  const { pdf, margin, contentW } = ctx;
  const gap = 10;
  const n = tiles.length;
  const w = (contentW - gap * (n - 1)) / n;
  const h = 50;
  ensureSpace(ctx, h + 10);
  const top = ctx.y;
  tiles.forEach((t, i) => {
    const x = margin + i * (w + gap);
    pdf.setFillColor(244, 248, 246);
    pdf.setDrawColor(...LINE);
    pdf.roundedRect(x, top, w, h, 5, 5, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(...BRAND);
    pdf.text(t.value, x + 10, top + 22);
    pdf.setFontSize(8.5);
    pdf.setTextColor(...INK);
    pdf.text(t.label, x + 10, top + 34);
    if (t.sub) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...MUTED);
      pdf.text(t.sub, x + 10, top + 43);
    }
  });
  ctx.y = top + h + 16;
}

/** A row of small count pills (indicators per theme). */
function countChips(ctx: Ctx, chips: { label: string; value: number; muted?: boolean }[]): void {
  const { pdf, margin, contentW } = ctx;
  const gap = 8;
  const n = chips.length;
  const w = (contentW - gap * (n - 1)) / n;
  const h = 40;
  ensureSpace(ctx, h + 8);
  const top = ctx.y;
  chips.forEach((c, i) => {
    const x = margin + i * (w + gap);
    pdf.setDrawColor(...LINE);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, top, w, h, 5, 5, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(...(c.muted ? MUTED : BRAND));
    pdf.text(String(c.value), x + 9, top + 19);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK);
    pdf.text(pdf.splitTextToSize(c.label, w - 16) as string[], x + 9, top + 30);
  });
  ctx.y = top + h + 14;
}

/** Composite score box + the three building-block sub-score bars. */
function scoreHeader(ctx: Ctx, grade: ReportSection['grade']): void {
  if (!grade) return;
  const { pdf, margin } = ctx;
  const boxW = 116;
  const boxH = 66;
  ensureSpace(ctx, boxH + 8);
  const top = ctx.y;
  // Score box.
  pdf.setFillColor(...BRAND_TINT);
  pdf.roundedRect(margin, top, boxW, boxH, 6, 6, 'F');
  pdf.setTextColor(...bandColor(grade.overall));
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(30);
  pdf.text(grade.overall != null ? String(Math.round(grade.overall)) : '—', margin + boxW / 2, top + 34, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text('/ 100 composite', margin + boxW / 2, top + 46, { align: 'center' });
  if (grade.grade) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...bandColor(grade.overall));
    pdf.text(`Grade ${grade.grade}`, margin + boxW / 2, top + 59, { align: 'center' });
  }
  // Block bars to the right.
  const bx = margin + boxW + 22;
  const barW = ctx.contentW - boxW - 22 - 44;
  let by = top + 12;
  for (const b of grade.blocks) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(b.short, bx, by + 2);
    pdf.setFillColor(...TRACK);
    pdf.roundedRect(bx + 74, by - 5, barW, 9, 2, 2, 'F');
    const w = b.score == null ? 0 : Math.max(0, Math.min(100, b.score)) / 100 * barW;
    pdf.setFillColor(...bandColor(b.score));
    if (w > 0) pdf.roundedRect(bx + 74, by - 5, w, 9, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(b.score != null ? String(Math.round(b.score)) : '—', margin + ctx.contentW, by + 2, { align: 'right' });
    by += 20;
  }
  ctx.y = top + boxH + 16;
}

function footer(ctx: Ctx): void {
  const { pdf, pageW, margin } = ctx;
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    const h = pdf.internal.pageSize.getHeight();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text('Real measured data unless marked as a national target (policy benchmark). NPHCDA PHC Intelligence Platform.', margin, h - 22);
    pdf.text(`Page ${p} of ${pages}`, pageW - margin, h - 22, { align: 'right' });
  }
}
