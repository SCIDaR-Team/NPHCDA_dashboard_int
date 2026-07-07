import { heatColor } from '@/data/calculations';

/**
 * Lightweight HTML/CSS mini-visualizations for indicator cards.
 *
 * These are the compact, per-card encodings selected in INDICATOR_VIZ_REDESIGN.md
 * (bullet, waffle, composition, pipeline, range, funnel, delta, zero-emphasis).
 * They are deliberately DOM-based rather than canvas: fully responsive, theme-aware
 * via the app's CSS variables, and cheap enough to render a dozen per page.
 *
 * Every component supports a `ghost` mode that renders the SHAPE of the intended
 * chart in muted greys with no numbers — used by pending indicators so no value is
 * ever fabricated.
 */

const GHOST_FILL = 'rgb(var(--c-border) / 0.55)';
const GHOST_SOFT = 'rgb(var(--c-border) / 0.3)';

/* ------------------------------------------------------------------ *
 * Bullet chart: measure vs 100% target with Poor/Fair/Good bands.
 * ------------------------------------------------------------------ */
export function MiniBullet({ pct, inverse, ghost }: { pct?: number; inverse?: boolean; ghost?: boolean }) {
  const v = ghost ? 0 : Math.min(100, Math.max(0, pct ?? 0));
  const color = ghost ? GHOST_FILL : heatColor(inverse ? 100 - v : v);
  return (
    <div aria-hidden={ghost}>
      <div className="relative h-4 w-full overflow-hidden rounded">
        {/* Qualitative bands: poor / fair / good */}
        <div className="absolute inset-0 flex">
          <span className="h-full bg-bg-elev-3" style={{ width: '33%' }} />
          <span className="h-full bg-bg-elev-3/70" style={{ width: '34%' }} />
          <span className="h-full bg-bg-elev-3/40" style={{ width: '33%' }} />
        </div>
        {/* Measure bar */}
        {!ghost && (
          <div
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-r"
            style={{ width: `${Math.max(v, 1.5)}%`, background: color }}
          />
        )}
        {ghost && (
          <div className="absolute left-0 top-1/2 h-1.5 w-2/5 -translate-y-1/2 rounded-r" style={{ background: GHOST_FILL }} />
        )}
        {/* Target line at 100% */}
        <div className="absolute right-[1px] top-0 h-full w-[2px] rounded bg-text/50" />
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] font-semibold uppercase tracking-wide text-muted-2">
        <span>Poor</span>
        <span>Fair</span>
        <span>Good</span>
        <span className="text-muted">Target 100%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Waffle: 10×10 unit grid — "X in every 100 facilities".
 * ------------------------------------------------------------------ */
export function MiniWaffle({ pct, inverse, ghost }: { pct?: number; inverse?: boolean; ghost?: boolean }) {
  const filled = ghost ? 0 : Math.round(Math.min(100, Math.max(0, pct ?? 0)));
  const color = ghost ? GHOST_FILL : heatColor(inverse ? 100 - filled : filled);
  return (
    <div className="flex items-center gap-3" aria-hidden={ghost}>
      <div className="grid flex-shrink-0 grid-cols-10 gap-[2px]" style={{ width: 112 }}>
        {Array.from({ length: 100 }).map((_, i) => (
          <span
            key={i}
            className="aspect-square rounded-[2px]"
            style={{ background: !ghost && i < filled ? color : GHOST_SOFT }}
          />
        ))}
      </div>
      {!ghost && (
        <div className="text-[11px] leading-snug text-muted">
          <b className="text-text">{filled}</b> in every <b className="text-text">100</b> facilities
        </div>
      )}
    </div>
  );
}

export interface CompositionSegment {
  label: string;
  pct?: number;
  color: string;
}

/* ------------------------------------------------------------------ *
 * 100% stacked composition bar with an inline labelled legend.
 * In ghost mode the segments render equal-width in greys (shape only) and an
 * optional `highlight` label is emphasised (vaccine stock-band family).
 * ------------------------------------------------------------------ */
export function MiniCompositionBar({
  segments,
  ghost,
  highlight,
  note,
}: {
  segments: CompositionSegment[];
  ghost?: boolean;
  highlight?: string;
  note?: string;
}) {
  return (
    <div aria-hidden={ghost}>
      <div className="flex h-3.5 overflow-hidden rounded-full">
        {segments.map((s, i) => {
          const w = ghost ? 100 / segments.length : Math.max(s.pct ?? 0, 0);
          if (w <= 0) return null;
          const emphasized = ghost && highlight === s.label;
          return (
            <span
              key={s.label}
              title={ghost ? s.label : `${s.label}: ${s.pct}%`}
              style={{
                width: `${w}%`,
                background: ghost ? (emphasized ? GHOST_FILL : GHOST_SOFT) : s.color,
                borderRight: i < segments.length - 1 ? '1px solid rgb(var(--c-bg) / 0.6)' : undefined,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] text-muted">
        {segments.map((s) => {
          const emphasized = ghost && highlight === s.label;
          return (
            <span key={s.label} className={emphasized ? 'font-bold text-text-soft' : ''}>
              <b style={{ color: ghost ? GHOST_FILL : s.color }}>■</b> {s.label}
              {!ghost && s.pct !== undefined && <> {s.pct}%</>}
            </span>
          );
        })}
      </div>
      {note && <div className="mt-1.5 text-[10px] text-muted-2">{note}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pipeline bar: a real part overlaid on its real pool (e.g. CBHWs trained of
 * recruited). Not a target — both figures are measurements.
 * ------------------------------------------------------------------ */
export function MiniPipeline({
  part,
  total,
  partLabel,
  totalLabel,
  color = '#2E8B57',
}: {
  part: number;
  total: number;
  partLabel: string;
  totalLabel: string;
  color?: string;
}) {
  const pct = total > 0 ? Math.min(100, (part / total) * 100) : 0;
  return (
    <div>
      <div className="relative h-4 w-full overflow-hidden rounded bg-bg-elev-3">
        <div className="absolute left-0 top-0 h-full rounded-r" style={{ width: `${Math.max(pct, 1.5)}%`, background: color }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-muted">
        <span>
          <b style={{ color }}>■</b> {partLabel}: <b className="text-text">{part.toLocaleString('en-US')}</b>
        </span>
        <span>
          {totalLabel}: <b className="text-text">{total.toLocaleString('en-US')}</b> ({Math.round(pct)}%)
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Range (dumbbell) plot for a bracketed estimate (e.g. MMR floor↔ceiling).
 * Neutral colouring on purpose — ranges must not be graded good/bad.
 * ------------------------------------------------------------------ */
export function MiniRangeBar({
  lo,
  hi,
  loLabel,
  hiLabel,
  unit,
}: {
  lo: number;
  hi: number;
  loLabel: string;
  hiLabel: string;
  unit: string;
}) {
  // Pad the axis 15% beyond the range so the dots don't sit on the edges.
  const span = Math.max(hi - lo, 1);
  const axMin = Math.max(0, lo - span * 0.15);
  const axMax = hi + span * 0.15;
  const x = (v: number) => ((v - axMin) / (axMax - axMin)) * 100;
  return (
    <div>
      <div className="relative h-6 w-full">
        <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded bg-bg-elev-3" />
        <div
          className="absolute top-1/2 h-[5px] -translate-y-1/2 rounded bg-warning/50"
          style={{ left: `${x(lo)}%`, width: `${x(hi) - x(lo)}%` }}
        />
        {[lo, hi].map((v, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-warning"
            style={{ left: `${x(v)}%` }}
            title={`${v.toLocaleString('en-US')} ${unit}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] leading-snug text-muted">
        <span>
          <b className="text-text">{lo.toLocaleString('en-US')}</b> {loLabel}
        </span>
        <span className="text-right">
          <b className="text-text">{hi.toLocaleString('en-US')}</b> {hiLabel}
        </span>
      </div>
      <div className="mt-0.5 text-center text-[10px] text-muted-2">{unit}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Two-stage funnel (ANC1 → ANC4): retention through the care pathway.
 * ------------------------------------------------------------------ */
export function MiniFunnel({
  stages,
  color = '#2E8B57',
}: {
  stages: { label: string; pct: number }[];
  color?: string;
}) {
  const max = Math.max(...stages.map((s) => s.pct), 1);
  const first = stages[0]?.pct ?? 0;
  const last = stages[stages.length - 1]?.pct ?? 0;
  const retention = first > 0 ? Math.round((last / first) * 100) : 0;
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const w = (s.pct / max) * 100;
        const shade = i === 0 ? color : heatColor(s.pct);
        return (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-12 flex-shrink-0 text-[10.5px] font-semibold text-muted">{s.label}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-bg-elev-3/60">
              <div
                className="h-full rounded-r"
                style={{ width: `${Math.max(w, 2)}%`, background: shade, opacity: i === 0 ? 0.55 : 1 }}
              />
            </div>
            <span className="w-11 flex-shrink-0 text-right text-[11px] font-bold text-text">{s.pct}%</span>
          </div>
        );
      })}
      <div className="text-[10px] text-muted-2">
        Retention {stages[0]?.label} → {stages[stages.length - 1]?.label}:{' '}
        <b className="text-muted">{retention}%</b> of entrants
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Diverging delta bar: signed change centred on zero.
 * ------------------------------------------------------------------ */
export function MiniDeltaBar({ delta }: { delta: number }) {
  const clamped = Math.max(-100, Math.min(100, delta));
  const w = Math.abs(clamped) / 2; // % of full width (half-axis each side)
  const positive = delta >= 0;
  const color = positive ? '#2E8B57' : '#C2562C';
  return (
    <div>
      <div className="relative h-4 w-full overflow-hidden rounded bg-bg-elev-3/60">
        <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-text/40" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2"
          style={{
            left: positive ? '50%' : `${50 - w}%`,
            width: `${Math.max(w, 1)}%`,
            background: color,
            borderRadius: positive ? '0 3px 3px 0' : '3px 0 0 3px',
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] font-semibold text-muted-2">
        <span>−100%</span>
        <span>0</span>
        <span>+100%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Zero-emphasis bar: a REAL reported zero (not a data gap).
 * ------------------------------------------------------------------ */
export function MiniZeroBar({ annotation }: { annotation: string }) {
  return (
    <div>
      <div className="relative h-4 w-full overflow-hidden rounded bg-bg-elev-3">
        <div className="absolute left-0 top-0 h-full w-[3px] rounded bg-danger" />
      </div>
      <div className="mt-1.5 text-[10.5px] leading-snug text-muted">
        <b className="text-danger">0%</b> — {annotation}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * KPI stat: a large headline count with an optional period delta + caption.
 * Used for unbounded volumes (facility deliveries) where the story is the
 * magnitude itself, not a proportion.
 * ------------------------------------------------------------------ */
export function MiniKpiStat({
  value,
  unit,
  sub,
  deltaText,
  deltaDir,
  columns,
  columnLabels,
  partialLastCol,
}: {
  value: string;
  unit?: string;
  sub?: string;
  deltaText?: string;
  deltaDir?: 'up' | 'down';
  /** Recent-period values rendered as a compact column trend under the number. */
  columns?: number[];
  columnLabels?: string[];
  /** De-emphasise the final column (an incomplete/partial latest period). */
  partialLastCol?: boolean;
}) {
  const up = deltaDir !== 'down';
  const colMax = columns && columns.length ? Math.max(...columns, 1) : 1;
  return (
    <div className="flex w-full flex-col items-center justify-center text-center">
      <div className="flex items-baseline justify-center gap-1.5">
        <div className="text-[38px] font-extrabold leading-none text-text">{value}</div>
        {unit && <div className="text-[11px] leading-snug text-muted">{unit}</div>}
      </div>
      {deltaText && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-bold ${up ? 'text-brand-bright' : 'text-danger'}`}>
          <span>{up ? '▲' : '▼'}</span>
          {deltaText}
        </div>
      )}
      {columns && columns.length > 1 && (
        <div className="mt-3 flex h-12 items-end justify-center gap-[4px]">
          {columns.map((v, i) => {
            const isLast = i === columns.length - 1;
            const dim = partialLastCol && isLast;
            return (
              <div
                key={i}
                className="w-3 rounded-t-sm"
                title={columnLabels?.[i] ? `${columnLabels[i]}${dim ? ' (partial)' : ''}` : undefined}
                style={{
                  height: `${Math.max((v / colMax) * 100, 6)}%`,
                  background: '#3D7BB5',
                  opacity: dim ? 0.35 : isLast ? 1 : 0.55,
                }}
              />
            );
          })}
        </div>
      )}
      {sub && <div className="mx-auto mt-2 max-w-[250px] text-[11px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Compare bars: a value against an explicit reference (e.g. rate vs target),
 * drawn as two labelled bars on a shared scale so "above/below" reads instantly.
 * ------------------------------------------------------------------ */
export function MiniCompareBars({
  rows,
  unit,
  verdict,
  verdictTone = 'bad',
}: {
  rows: { label: string; value: number; color: string }[];
  unit?: string;
  verdict?: string;
  verdictTone?: 'good' | 'bad';
}) {
  const max = Math.max(...rows.map((r) => r.value), 1) * 1.15;
  return (
    <div className="w-full space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="font-semibold text-text-soft">{r.label}</span>
            <span className="font-extrabold text-text">{r.value.toLocaleString('en-US')}</span>
          </div>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-bg-elev-3">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
      {unit && <div className="pt-0.5 text-[10px] text-muted-2">{unit}</div>}
      {verdict && (
        <div className={`text-[11px] font-bold ${verdictTone === 'good' ? 'text-brand-bright' : 'text-danger'}`}>
          {verdict}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Rate bar: a single rate (e.g. mortality per 100k) on a contextual scale,
 * with an optional published benchmark tick. Uses only the real reported rate.
 * ------------------------------------------------------------------ */
export function MiniRateBar({
  value,
  unit,
  max,
  color,
  benchmark,
  benchmarkLabel,
  note,
}: {
  value: number;
  unit: string;
  max: number;
  color: string;
  benchmark?: number;
  benchmarkLabel?: string;
  note?: string;
}) {
  const x = (n: number) => Math.min(100, Math.max(0, (n / max) * 100));
  return (
    <div>
      <div className="flex items-end gap-2">
        <span className="text-[30px] font-extrabold leading-none text-text">{value.toLocaleString('en-US')}</span>
        <span className="mb-0.5 text-[11px] leading-snug text-muted">{unit}</span>
      </div>
      <div className="relative mt-5 h-3 w-full rounded-full bg-bg-elev-3">
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${x(value)}%`, background: color }} />
        {benchmark != null && (
          <>
            <div
              className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-muted"
              style={{ left: `${x(benchmark)}%` }}
            >
              {benchmarkLabel}
            </div>
            <div
              className="absolute -top-1 h-5 w-[2px] -translate-x-1/2 rounded bg-text/70"
              style={{ left: `${x(benchmark)}%` }}
            />
          </>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[9.5px] text-muted-2">
        <span>0</span>
        <span>{max.toLocaleString('en-US')}</span>
      </div>
      {note && <div className="mt-1.5 text-[10px] leading-snug text-muted-2">{note}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ungraded rate stat: deliberately chart-free (small-n interim rates).
 * ------------------------------------------------------------------ */
export function MiniRateNote({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-border-soft bg-bg-elev-2/50 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
      {note}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ghost wrapper: dims the intended chart shape and overlays the empty-state
 * message, so pending indicators preview their final visualization without
 * fabricating a single number.
 * ------------------------------------------------------------------ */
export function GhostViz({ children, message }: { children: React.ReactNode; message: string }) {
  return (
    <div>
      <div className="pointer-events-none select-none opacity-70">{children}</div>
      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] leading-snug">
        <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" />
        <span>
          <b className="text-text-soft">Awaiting data.</b> <span className="text-muted">{message}</span>
        </span>
      </div>
    </div>
  );
}
