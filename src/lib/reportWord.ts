/**
 * Executive report → Word (.doc) exporter.
 *
 * Builds a self-contained, Word-compatible HTML document from the shared ReportModel
 * and saves it with a .doc extension — Word opens it natively as an editable document.
 * Prose is justified, figures sit in bordered tables, and charts are rendered as
 * table-cell bars (the most reliable chart primitive in Word's HTML import). Same model
 * as the PDF, so the two stay consistent; unlike a rasterised capture, this stays fully
 * editable. Everything is real measured data or a clearly-labelled national target.
 */
import { saveAs } from 'file-saver';
import type { ReportModel, ReportSection, ReportKpi, ReportBlockRow } from '@/data/reportModel';
import { formatDate } from '@/lib/freshness';

const C = {
  brand: '#0f6b52',
  ink: '#1b2430',
  muted: '#6b7686',
  line: '#e1e6ec',
  track: '#eef1f5',
  good: '#2e8b57',
  bad: '#c2562c',
  target: '#b9922a',
};

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

const variance = (d?: number): string =>
  d == null ? `<span style="color:${C.muted}">—</span>` : `<b style="color:${d >= 0 ? C.good : C.bad}">${d > 0 ? '+' : ''}${d}</b>`;

/** A Word-safe horizontal bar: a 2-cell table, filled portion coloured. */
function barRow(label: string, pct: number, right: string, color: string, target?: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const targetMark =
    target != null
      ? `<td width="1" style="border-left:1.5px solid ${C.target}">&nbsp;</td><td width="${Math.max(0, 100 - Math.min(100, target))}%">&nbsp;</td>`
      : '';
  const fillW = target != null ? Math.min(p, target) : p; // keep target tick visible
  return `
  <tr>
    <td width="42%" style="padding:3px 8px 3px 0;font-size:10pt;color:${C.ink}">${esc(label)}</td>
    <td width="40%" style="padding:3px 0">
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;height:12px"><tr>
        <td width="${fillW}%" bgcolor="${color}" style="height:12px">&nbsp;</td>
        ${target != null ? targetMark : `<td width="${100 - p}%" bgcolor="${C.track}">&nbsp;</td>`}
      </tr></table>
    </td>
    <td width="18%" style="padding:3px 0 3px 8px;font-size:8.5pt;color:${C.muted};text-align:right">${esc(right)}</td>
  </tr>`;
}

function barBlock(rows: { label: string; pct: number; right: string; color: string; target?: number }[]): string {
  if (!rows.length) return '';
  return `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:6px 0 12px">${rows
    .map((r) => barRow(r.label, r.pct, r.right, r.color, r.target))
    .join('')}</table>`;
}

function measuredTable(head: string[], rows: string[][]): string {
  return `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:4px 0 6px">
    <tr>${head.map((h, i) => `<th style="background:${C.brand};color:#fff;text-align:${i === 0 ? 'left' : 'left'};font-size:8.5pt;padding:5px 8px;text-transform:uppercase;letter-spacing:.3px">${esc(h)}</th>`).join('')}</tr>
    ${rows
      .map(
        (r, ri) =>
          `<tr style="background:${ri % 2 ? '#f7f9fb' : '#fff'}">${r
            .map((c, ci) => `<td style="border-bottom:1px solid ${C.line};font-size:9.5pt;padding:5px 8px;color:${C.ink}${ci === 0 ? ';font-weight:normal' : ''}">${c}</td>`)
            .join('')}</tr>`
      )
      .join('')}
  </table>`;
}

function targetBars(rows: (ReportKpi | ReportBlockRow)[]): string {
  const targeted = rows.filter((r) => r.target != null).slice(0, 8);
  return barBlock(
    targeted.map((r) => ({
      label: 'label' in r ? r.label : r.name,
      pct: r.pct,
      right: `${Math.round(r.pct)}% · tgt ${r.target}%`,
      color: (r.delta ?? 0) >= 0 ? C.good : C.bad,
      target: r.target,
    }))
  );
}

function sectionHtml(s: ReportSection, no: number): string {
  const head = `<h2 style="color:${C.brand};font-size:14pt;margin:22px 0 2px">${no}. ${esc(s.title)}</h2>
    <div style="border-bottom:1px solid ${C.line};margin-bottom:8px"></div>`;
  const prose = s.narrative.trim() ? `<p style="text-align:justify;line-height:1.55;font-size:10.5pt;margin:0 0 12px;color:#33404f">${esc(s.narrative)}</p>` : '';

  let body = '';
  if (s.kind === 'coverage' && s.coverage) {
    const c = s.coverage;
    const nf = (n: number) => n.toLocaleString('en-US');
    const tile = (value: string, label: string, sub?: string) =>
      `<td width="25%" valign="top" style="background:#f4f8f6;border:1px solid ${C.line};padding:10px 12px">
        <div style="font-size:18pt;font-weight:bold;color:${C.brand}">${esc(value)}</div>
        <div style="font-size:9pt;font-weight:bold;color:${C.ink}">${esc(label)}</div>
        ${sub ? `<div style="font-size:8pt;color:${C.muted}">${esc(sub)}</div>` : ''}
      </td>`;
    const tiles = `<table width="100%" cellspacing="6" cellpadding="0" style="margin:2px 0 14px"><tr>
      ${tile(String(c.live), 'Live indicators', `of ${c.total} prioritized`)}
      ${tile(nf(c.states), 'States')}${tile(nf(c.lgas), 'LGAs')}${tile(nf(c.facilities), 'Facilities')}
    </tr></table>`;
    const chip = (value: string, label: string, muted?: boolean) =>
      `<td valign="top" style="border:1px solid ${C.line};padding:8px 12px">
        <div style="font-size:15pt;font-weight:bold;color:${muted ? C.muted : C.brand}">${esc(value)}</div>
        <div style="font-size:8.5pt;color:${C.ink}">${esc(label)}</div></td>`;
    const themeChips = `<table cellspacing="6" cellpadding="0" style="margin:2px 0 12px"><tr>
      ${c.themes.map((t) => chip(String(t.indicators), t.name)).join('')}
    </tr></table>`;
    const progTable = measuredTable(
      ['Programme', 'Indicators fed', 'Records', 'Facilities reporting'],
      c.programmes.map((p) => [`<b>${esc(p.name)}</b>`, String(p.indicators), nf(p.records), nf(p.facilities)])
    );
    body = `${tiles}<p style="font-size:8.5pt;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;margin:8px 0 2px">Prioritized indicators by theme</p>${themeChips}<p style="font-size:8.5pt;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;margin:8px 0 2px">Reporting programmes</p>${progTable}`;
  } else if (s.kind === 'grade' && s.grade) {
    const g = s.grade;
    const blockBars = barBlock(g.blocks.map((b) => ({ label: b.short, pct: b.score ?? 0, right: b.score != null ? String(Math.round(b.score)) : '—', color: C.brand })));
    const scoreBadge = `<div style="display:inline-block;padding:6px 14px;background:#e8f2ee;border-radius:6px;margin-bottom:8px">
      <span style="font-size:22pt;font-weight:bold;color:${C.brand}">${g.overall != null ? Math.round(g.overall) : '—'}</span>
      <span style="font-size:10pt;color:${C.muted}"> / 100${g.grade ? ` · Grade ${g.grade}` : ''}</span></div>`;
    const kpiTable = s.kpis?.length
      ? measuredTable(
          ['Headline indicator', 'Value', 'Target', 'Var.'],
          s.kpis.map((k) => [esc(k.label), `<b>${esc(k.value)}</b>`, k.target != null ? `${k.target}%` : '—', variance(k.delta)])
        )
      : '';
    body = `${scoreBadge}${blockBars}${(s.kpis ?? []).some((k) => k.target != null) ? `<p style="font-size:8.5pt;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;margin:4px 0">Headline indicators vs national target</p>${targetBars(s.kpis!)}` : ''}${kpiTable}`;
  } else if (s.kind === 'block' && s.block) {
    body = `${targetBars(s.block.rows)}${measuredTable(
      ['Indicator', 'Value', 'Target', 'Var.'],
      s.block.rows.map((r) => [esc(r.name), `<b>${esc(r.value)}</b>`, r.target != null ? `${r.target}%` : '—', variance(r.delta)])
    )}`;
  }

  return `<div>${head}${prose}${body}</div>`;
}

/** Build the full Word-compatible HTML document string. */
export function buildReportHtml(model: ReportModel): string {
  const meta =
    `Generated ${formatDate(model.generatedAt)}` +
    (model.meta?.generatedAt ? `   ·   Data snapshot: ${formatDate(model.meta.generatedAt)}` : '') +
    (model.meta?.period?.from && model.meta?.period?.to ? `   ·   Period ${model.meta.period.from} – ${model.meta.period.to}` : '');
  const sections = model.sections.filter((s) => s.enabled).map((s, i) => sectionHtml(s, i + 1)).join('');
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>NPHCDA Executive Report</title>
<style>
  @page { size: A4; margin: 1.6cm 1.6cm; }
  body { font-family: Calibri, Arial, sans-serif; color: ${C.ink}; font-size: 11pt; }
  h1 { font-size: 18pt; margin: 0; }
  p { margin: 0 0 10px; }
</style></head>
<body>
  <div style="background:${C.brand};color:#fff;padding:20px 22px;margin-bottom:14px">
    <h1>NPHCDA PHC Intelligence — Executive Report</h1>
    <p style="font-size:12pt;font-weight:bold;margin:6px 0 0">Scope: ${esc(model.scopeLabel)}</p>
    <p style="font-size:9pt;color:#dbeee7;margin:3px 0 0">${esc(meta)}</p>
  </div>
  ${sections}
  <p style="margin-top:22px;padding-top:10px;border-top:1px solid ${C.line};font-size:8.5pt;color:${C.muted}">
    Real measured data unless marked as a national target (policy benchmark). NPHCDA PHC Intelligence Platform.
  </p>
</body></html>`;
}

/** Render the model to a Word-openable .doc file and save it. */
export function renderReportModelWord(model: ReportModel, filename = 'nphcda-executive-report.doc'): void {
  const html = buildReportHtml(model);
  const blob = new Blob(['﻿', html], { type: 'application/msword;charset=utf-8' });
  saveAs(blob, filename.endsWith('.doc') ? filename : `${filename}.doc`);
}
