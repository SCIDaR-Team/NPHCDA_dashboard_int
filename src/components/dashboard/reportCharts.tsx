/**
 * Report chart primitives — lightweight inline SVG, styled with a FIXED light-paper
 * palette (no CSS variables). The executive report renders on a white sheet regardless
 * of the app theme, and inline SVG with explicit colours rasterises cleanly through
 * html2canvas, so the PDF looks identical to the preview.
 */
import type { ReportBlockRow, ReportKpi } from '@/data/reportModel';

export const PAPER = {
  ink: '#1b2430',
  muted: '#6b7686',
  line: '#e4e8ee',
  track: '#eef1f5',
  brand: '#0f6b52',
  good: '#2e8b57',
  bad: '#c2562c',
  target: '#b9922a',
} as const;

/** Colour for a 0–100 score band (good ≥67 / fair ≥34 / poor). */
function bandColor(v: number | null): string {
  if (v == null) return PAPER.muted;
  return v >= 67 ? PAPER.good : v >= 34 ? PAPER.target : PAPER.bad;
}

/** Composite score as a donut ring with the grade in the centre. */
export function ScoreRing({ value, grade, size = 128 }: { value: number | null; grade: string | null; size?: number }) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const pctVal = value == null ? 0 : Math.max(0, Math.min(100, value));
  const offset = c * (1 - pctVal / 100);
  const color = bandColor(value);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Composite ${value ?? 'not graded'} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PAPER.track} strokeWidth={11} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={11}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="46%" textAnchor="middle" fontSize={26} fontWeight={800} fill={PAPER.ink}>
        {value != null ? Math.round(value) : '—'}
      </text>
      <text x="50%" y="60%" textAnchor="middle" fontSize={11} fill={PAPER.muted}>
        / 100
      </text>
      {grade && (
        <text x="50%" y="76%" textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>
          Grade {grade}
        </text>
      )}
    </svg>
  );
}

/** The three building-block sub-scores as compact horizontal bars. */
export function BlockScoreBars({ blocks }: { blocks: { name: string; short: string; score: number | null }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
      {blocks.map((b) => {
        const w = b.score == null ? 0 : Math.max(0, Math.min(100, b.score));
        return (
          <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 78, fontSize: 11, color: PAPER.muted }}>{b.short}</span>
            <div style={{ position: 'relative', flex: 1, height: 10, borderRadius: 6, background: PAPER.track }}>
              <div style={{ position: 'absolute', inset: 0, width: `${w}%`, borderRadius: 6, background: bandColor(b.score) }} />
            </div>
            <span style={{ width: 30, textAlign: 'right', fontSize: 12, fontWeight: 700, color: PAPER.ink }}>
              {b.score != null ? Math.round(b.score) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Measured value vs national target — a horizontal bar with a target tick. Only rows
 *  that carry a target are charted (higher-is-better proportions); the rest live in the
 *  table beneath. */
export function TargetBars({ rows }: { rows: (ReportKpi | ReportBlockRow)[] }) {
  const targeted = rows.filter((r) => r.target != null).slice(0, 8);
  if (!targeted.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {targeted.map((r) => {
        const label = 'label' in r ? r.label : r.name;
        const pct = Math.max(0, Math.min(100, r.pct));
        const met = (r.delta ?? 0) >= 0;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 220, fontSize: 11.5, color: PAPER.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            <div style={{ position: 'relative', flex: 1, height: 14, borderRadius: 4, background: PAPER.track }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: 14, width: `${pct}%`, borderRadius: 4, background: met ? PAPER.good : PAPER.bad }} />
              {/* Target marker */}
              <div style={{ position: 'absolute', top: -2, height: 18, width: 2, left: `${Math.min(100, r.target as number)}%`, background: PAPER.target }} title={`Target ${r.target}%`} />
            </div>
            <span style={{ width: 92, textAlign: 'right', fontSize: 11, color: PAPER.muted }}>
              {Math.round(pct)}% · tgt {r.target}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Big-number stat tiles for the coverage header. */
export function StatTiles({ tiles }: { tiles: { label: string; value: string; sub?: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {tiles.map((t) => (
        <div key={t.label} style={{ flex: '1 1 120px', minWidth: 120, background: '#f4f8f6', border: `1px solid ${PAPER.line}`, borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: PAPER.brand, lineHeight: 1.1 }}>{t.value}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: PAPER.ink, marginTop: 3 }}>{t.label}</div>
          {t.sub && <div style={{ fontSize: 10, color: PAPER.muted, marginTop: 1 }}>{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

