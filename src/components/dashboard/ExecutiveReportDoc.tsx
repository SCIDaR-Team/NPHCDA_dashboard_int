/**
 * The executive report DOCUMENT — a white A4-like sheet rendered with a fixed light
 * palette and inline styles, independent of the app theme. It is the single visual
 * source of truth: the Report Builder shows it as a live preview, and the PDF exporter
 * rasterises the very same DOM section-by-section, so the download matches the preview.
 *
 * Prose interprets the numbers, charts visualise them, and tables give the detail —
 * a real briefing, not a table dump.
 */
import { forwardRef } from 'react';
import type { ReportModel, ReportSection } from '@/data/reportModel';
import { formatDate } from '@/lib/freshness';
import { PAPER, ScoreRing, BlockScoreBars, TargetBars, StatTiles } from './reportCharts';

const nf = (n: number): string => n.toLocaleString('en-US');

/** A small labelled count pill (indicators per theme). */
function CountChip({ label, count, muted }: { label: string; count: number; muted?: boolean }) {
  return (
    <div style={{ border: `1px solid ${PAPER.line}`, borderRadius: 8, padding: '8px 12px', minWidth: 96 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: muted ? PAPER.muted : PAPER.brand }}>{count}</div>
      <div style={{ fontSize: 10.5, color: PAPER.ink, marginTop: 1 }}>{label}</div>
    </div>
  );
}

/** Fixed page width (px) — a comfortable print measure that maps cleanly to A4. */
export const REPORT_WIDTH = 760;

const S = {
  paper: { width: REPORT_WIDTH, background: '#ffffff', color: PAPER.ink, fontFamily: 'Inter, system-ui, sans-serif' } as React.CSSProperties,
  band: { background: PAPER.brand, color: '#fff', padding: '30px 40px' } as React.CSSProperties,
  body: { padding: '14px 40px 36px' } as React.CSSProperties,
  section: { padding: '28px 0', borderTop: `1px solid ${PAPER.line}` } as React.CSSProperties,
  h2: { margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: PAPER.brand } as React.CSSProperties,
  prose: { margin: '10px 0 20px', fontSize: 13, lineHeight: 1.7, color: '#33404f', textAlign: 'justify' } as React.CSSProperties,
  subLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: PAPER.muted, margin: '4px 0 12px' } as React.CSSProperties,
  th: { textAlign: 'left', padding: '7px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: '#fff', background: PAPER.brand } as React.CSSProperties,
  td: { padding: '7px 10px', fontSize: 12.5, color: PAPER.ink, borderBottom: `1px solid ${PAPER.line}` } as React.CSSProperties,
};

const variance = (d?: number) =>
  d == null ? <span style={{ color: PAPER.muted }}>—</span> : <span style={{ fontWeight: 700, color: d >= 0 ? PAPER.good : PAPER.bad }}>{d > 0 ? '+' : ''}{d}</span>;

function Table({ head, children, widths }: { head: string[]; children: React.ReactNode; widths?: (number | undefined)[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <thead>
        <tr>{head.map((h, i) => <th key={h} style={{ ...S.th, width: widths?.[i] }}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function SectionView({ section: s }: { section: ReportSection }) {
  return (
    <section data-report-block style={S.section}>
      <h2 style={S.h2}>{s.title}</h2>
      {s.narrative.trim() && <p style={S.prose}>{s.narrative}</p>}
      <SectionBody section={s} />
    </section>
  );
}

function SectionBody({ section: s }: { section: ReportSection }) {
  if (s.kind === 'coverage' && s.coverage) {
    const c = s.coverage;
    return (
      <div>
        <StatTiles
          tiles={[
            { label: 'Live indicators', value: String(c.live), sub: `of ${c.total} prioritized` },
            { label: 'States', value: nf(c.states) },
            { label: 'LGAs', value: nf(c.lgas) },
            { label: 'Facilities', value: nf(c.facilities) },
          ]}
        />
        <p style={{ ...S.subLabel, marginTop: 22 }}>Prioritized indicators by theme</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          {c.themes.map((t) => <CountChip key={t.name} label={t.name} count={t.indicators} />)}
        </div>
        <p style={S.subLabel}>Reporting programmes</p>
        <Table head={['Programme', 'Indicators fed', 'Records', 'Facilities reporting']} widths={[undefined, 100, 90, 120]}>
          {c.programmes.map((p) => (
            <tr key={p.name}>
              <td style={{ ...S.td, fontWeight: 700 }}>{p.name}</td>
              <td style={S.td}>{p.indicators}</td>
              <td style={S.td}>{nf(p.records)}</td>
              <td style={S.td}>{nf(p.facilities)}</td>
            </tr>
          ))}
        </Table>
      </div>
    );
  }

  if (s.kind === 'grade' && s.grade) {
    const g = s.grade;
    const hasTargets = (s.kpis ?? []).some((k) => k.target != null);
    return (
      <div>
        <div style={{ display: 'flex', gap: 36, alignItems: 'center', flexWrap: 'wrap', marginBottom: hasTargets ? 24 : 14 }}>
          <ScoreRing value={g.overall} grade={g.grade} />
          <BlockScoreBars blocks={g.blocks} />
        </div>
        {hasTargets && (
          <div style={{ marginBottom: 20 }}>
            <p style={S.subLabel}>Headline indicators vs national target</p>
            <TargetBars rows={s.kpis!} />
          </div>
        )}
        {s.kpis && s.kpis.length > 0 && (
          <Table head={['Headline indicator', 'Value', 'Target', 'Var.']} widths={[undefined, 90, 70, 60]}>
            {s.kpis.map((k) => (
              <tr key={k.label}>
                <td style={S.td}>{k.label}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{k.value}</td>
                <td style={S.td}>{k.target != null ? `${k.target}%` : '—'}</td>
                <td style={S.td}>{variance(k.delta)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    );
  }

  if (s.kind === 'block' && s.block) {
    const hasTargets = s.block.rows.some((r) => r.target != null);
    return (
      <div>
        {hasTargets && (
          <div style={{ marginBottom: 20 }}>
            <TargetBars rows={s.block.rows} />
          </div>
        )}
        <Table head={['Indicator', 'Value', 'Target', 'Var.']} widths={[undefined, 90, 70, 60]}>
          {s.block.rows.map((r) => (
            <tr key={r.name}>
              <td style={S.td}>{r.name}</td>
              <td style={{ ...S.td, fontWeight: 700 }}>{r.value}</td>
              <td style={S.td}>{r.target != null ? `${r.target}%` : '—'}</td>
              <td style={S.td}>{variance(r.delta)}</td>
            </tr>
          ))}
        </Table>
      </div>
    );
  }

  return null;
}

/** The full report sheet. `ref` points at the outer paper node the exporter captures. */
export const ExecutiveReportDoc = forwardRef<HTMLDivElement, { model: ReportModel }>(function ExecutiveReportDoc({ model }, ref) {
  const enabled = model.sections.filter((s) => s.enabled);
  return (
    <div ref={ref} style={S.paper} data-report-root>
      <div style={S.band} data-report-block>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>NPHCDA PHC Intelligence — Executive Report</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>Scope: {model.scopeLabel}</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
          Generated {formatDate(model.generatedAt)}
          {model.meta?.generatedAt ? `  ·  Data snapshot: ${formatDate(model.meta.generatedAt)}` : ''}
          {model.meta?.period?.from && model.meta?.period?.to ? `  ·  Period ${model.meta.period.from} – ${model.meta.period.to}` : ''}
        </p>
      </div>
      <div style={S.body}>
        {enabled.map((s) => <SectionView key={s.id} section={s} />)}
        <p style={{ marginTop: 22, paddingTop: 12, borderTop: `1px solid ${PAPER.line}`, fontSize: 10.5, color: PAPER.muted }}>
          Real measured data unless marked as a national target (policy benchmark). NPHCDA PHC Intelligence Platform.
        </p>
      </div>
    </div>
  );
});
