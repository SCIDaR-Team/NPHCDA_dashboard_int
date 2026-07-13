import { RingProgress } from '@/components/charts/RingProgress';
import {
  MiniBullet,
  MiniCompositionBar,
  MiniPipeline,
  MiniFunnel,
  MiniDeltaBar,
  MiniZeroBar,
  MiniKpiStat,
  MiniCompareBars,
  MiniCauseBars,
  MiniRateBar,
  GhostViz,
  type CompositionSegment,
} from '@/components/charts/mini/svgMinis';
import {
  MiniDonut,
  MiniGauge,
  MiniStateBars,
  type MiniBarRow,
} from '@/components/charts/mini/echartsMinis';
import { CHART_GREEN, CHART_GREEN_SOFT, CHART_GREEN_FAINT, secondaryColor } from '@/components/charts/palette';
import { stateMeasures } from '@/data/calculations';
import { HIDE_ZERO_DISTRIBUTION_INDICATORS } from '@/data/scopedEngine';
import { decodeHtml } from '@/lib/format';
import type { Indicator, Split4, TrendSeries } from '@/data/types';

/**
 * Per-indicator visualization selection (see INDICATOR_VIZ_REDESIGN.md for the
 * full design rationale). Each of the 38 indicator cards maps to the chart type
 * that best communicates ITS data shape:
 *
 *   counts            → KPI + ranked top-states bars (never a progress bar)
 *   binary shares     → donut
 *   composite "ALL items" measures → bullet with Poor/Fair/Good bands
 *   saturation %      → radial progress
 *   compositions      → 100% stacked bar
 *   trends            → area chart (real ETL series)
 *   cascade           → funnel (ANC1 → ANC4)
 *   bracketed levels  → range/dumbbell (MMR floor↔ceiling)
 *   signed change     → zero-centred diverging bar
 *
 * Every kind also renders as a GHOST (shape only, no fabricated numbers) when the
 * indicator has no live source yet — the map declares the indicator's intended
 * chart once, and data availability decides live vs ghost at render time.
 */

export type VizKind =
  | 'stateBarsCount' // count + per-state ranked bars (distinct colour per state)
  | 'stateBarsNaira' // ₦ amounts by state
  | 'bullet'
  | 'radial'
  | 'donutBinary'
  | 'donutCause'
  | 'donutFp'
  | 'barSplit' // 4-way functional-status composition as ranked bars (L2/L1/partial/non-func)
  | 'gauge'
  | 'pipeline'
  | 'kpiStat' // large headline count + period delta (unbounded volumes)
  | 'funnel'
  | 'delta'
  | 'rateBar' // single rate on a contextual scale + benchmark tick
  | 'composition'; // 100% stacked bar (functional status live; band/stream previews ghost)

export interface VizSpec {
  kind: VizKind;
  /** donutBinary: [yes label, no label]. */
  donutLabels?: [string, string];
  /** donutBinary: at a REAL reported 0 (not a data gap), show the zero-emphasis bar
   *  instead of a meaningless solid "no" ring; a proper donut renders once non-zero. */
  zeroEmphasis?: boolean;
  /** donutCause: this card's cause name. */
  cause?: string;
  /** trend: key into the snapshot trend series. */
  trendKey?: string;
  trendIsPct?: boolean;
  /** pipeline: sibling indicator holding the pool count. */
  poolIndicator?: string;
  poolLabels?: { part: string; total: string };
  /** composition (ghost preview): segment labels + which one this card measures. */
  ghostSegments?: string[];
  ghostHighlight?: string;
  ghostNote?: string;
}

const NEUTRAL_BAR = CHART_GREEN; // counts are a single category → one brand green

const CAUSE_INDICATORS: Record<string, string> = {
  PPH: 'Proportion of maternal deaths resulting from PPH',
  'Pre-eclampsia/eclampsia': 'Proportion of maternal deaths resulting from pre-eclampsia/eclampsia',
  Sepsis: 'Proportion of maternal deaths resulting from sepsis',
};

const VACCINE_BANDS = ['Sufficient (50–80%)', 'Reorder (25–50%)', 'Understocked (<25%)', 'Stocked out'];
const BAND_NOTE = 'This card measures the highlighted band of the vaccine stock distribution.';

export const VIZ_MAP: Record<string, VizSpec> = {
  /* ---------------- Facility Readiness ---------------- */
  'Facility functional status per state (L1 / L2 / partial / non-functional)': { kind: 'barSplit' },
  'Number of revitalized PHC facilities per state': { kind: 'stateBarsCount' },
  'Proportion of visited PHCs offering the full essential service package*': {
    kind: 'donutBinary',
    donutLabels: ['Full package', 'Incomplete'],
  },
  'Proportion of visited PHCs with functional maternal health equipment*': { kind: 'gauge' },
  'Number of SBAs recruited': { kind: 'stateBarsCount' },
  'Proportion of SBAs deployed per state': { kind: 'radial' },
  'Number of CBHWs trained': {
    kind: 'pipeline',
    poolIndicator: 'Proportion of CBHWs recruited',
    poolLabels: { part: 'Trained', total: 'Recruited' },
  },
  'Proportion of CBHWs recruited': { kind: 'stateBarsCount' },
  'Proportion of CBHWs deployed per state': { kind: 'gauge' },
  '% of recruited CBHWs that have been absorbed': {
    kind: 'donutBinary',
    donutLabels: ['Absorbed', 'Not absorbed'],
    zeroEmphasis: true, // 0% absorbed today → zero-emphasis bar; donut once non-zero
  },
  'Proportion of facilities with a minimum of 4 SBAs': {
    kind: 'donutBinary',
    donutLabels: ['≥ 4 SBAs', 'Below minimum'],
  },
  'Proportion of BHCPF facilities that received their quarterly disbursement': {
    kind: 'donutBinary',
    donutLabels: ['Received', 'Not received'],
  },
  'Total BHCPF funds received vs. expected': { kind: 'stateBarsNaira' },
  'Proportion of BHCPF facilities that received NHIA capitation funds': {
    kind: 'donutBinary',
    donutLabels: ['Received', 'Not received'],
  },
  'Proportion of facilities receiving BOTH NPHCDA Gateway and NHIA Capitation funds': {
    kind: 'composition',
    ghostSegments: ['Both streams', 'Gateway only', 'NHIA only', 'Neither'],
    ghostHighlight: 'Both streams',
    ghostNote: 'The synergy test: what share of facilities receive both funding streams.',
  },
  'Number of planned work plan activities completed': { kind: 'bullet' },

  /* ---------------- Stock Status ---------------- */
  'Proportion of PHCs with all six tracer commodities available*': {
    kind: 'donutBinary',
    donutLabels: ['All six tracers', 'Missing ≥ 1'],
  },
  'Proportion of facilities with the PPH bundle available*': { kind: 'gauge' },
  'Proportion of wards / main PHCs with functional cold-chain equipment (SDD/CCE)': {
    kind: 'donutBinary',
    donutLabels: ['Functional', 'Not functional'],
  },
  'Proportion of vaccines sufficient (above reorder point, 50-80%)': {
    kind: 'composition',
    ghostSegments: VACCINE_BANDS,
    ghostHighlight: VACCINE_BANDS[0],
    ghostNote: BAND_NOTE,
  },
  'Proportion of vaccines at reorder level (25-50%)': {
    kind: 'composition',
    ghostSegments: VACCINE_BANDS,
    ghostHighlight: VACCINE_BANDS[1],
    ghostNote: BAND_NOTE,
  },
  'Proportion of vaccines understocked (&lt;25%)': {
    kind: 'composition',
    ghostSegments: VACCINE_BANDS,
    ghostHighlight: VACCINE_BANDS[2],
    ghostNote: BAND_NOTE,
  },
  'Proportion of vaccines stocked out at the last mile': {
    kind: 'composition',
    ghostSegments: VACCINE_BANDS,
    ghostHighlight: VACCINE_BANDS[3],
    ghostNote: BAND_NOTE,
  },

  /* ---------------- Service Delivery ---------------- */
  'Number of deliveries in facilities': { kind: 'kpiStat', trendKey: 'Facility deliveries (count)' },
  'Proportion of deliveries attended by a skilled birth attendant': { kind: 'radial' },
  '% of women with a live birth who attended ANC 1': {
    kind: 'donutBinary',
    donutLabels: ['Attended ANC 1', 'Did not attend'],
  },
  '% of women with a live birth who attended ANC 4': { kind: 'funnel' },
  '% of family planning clients using modern contraceptives': { kind: 'donutFp' },
  '% increase in utilization of FP services': { kind: 'delta' },
  'Proportion of children &lt;1 year who received Penta 3': {
    kind: 'donutBinary',
    donutLabels: ['Received Penta 3', 'Not received'],
  },
  'Proportion of children &lt;1 year who received Measles 1': { kind: 'bullet' },
  'Number of zero-dose children (burden)': { kind: 'stateBarsCount' },
  'Proportion of girls aged 9 who received the HPV vaccine dose': { kind: 'radial' },
  'Maternal Mortality Ratio - BHCPF vs. non-BHCPF facilities': { kind: 'rateBar' },
  'Under-5 Mortality Rate - BHCPF vs. non-BHCPF facilities': { kind: 'rateBar' },
  'Proportion of maternal deaths resulting from PPH': { kind: 'donutCause', cause: 'PPH' },
  'Proportion of maternal deaths resulting from pre-eclampsia/eclampsia': {
    kind: 'donutCause',
    cause: 'Pre-eclampsia/eclampsia',
  },
  'Proportion of maternal deaths resulting from sepsis': { kind: 'donutCause', cause: 'Sepsis' },
};

/** Kinds whose selected chart needs the wide (2-column) card layout. */
const WIDE_KINDS = new Set<VizKind>(['composition', 'barSplit', 'stateBarsCount', 'stateBarsNaira']);

/** Kinds whose chart embeds the headline number, so the card need not repeat it. */
const EMBEDS_VALUE = new Set<VizKind>([
  'donutBinary',
  'donutCause',
  'donutFp',
  'gauge',
  'radial',
  'kpiStat',
  'rateBar',
]);

/** Radial (saturation %) rings use the single brand green, not the heat scale. */
const RADIAL_COLOR = CHART_GREEN;

/** Rate-bar context (scale + published benchmark) for the two mortality ratios. */
const RATE_CFG: Record<
  string,
  { unit: string; max: number; color: string; benchmark?: number; benchmarkLabel?: string; note?: string }
> = {
  'Maternal Mortality Ratio - BHCPF vs. non-BHCPF facilities': {
    unit: 'per 100,000 live births',
    max: 260,
    color: '#C2562C',
    benchmark: 70,
    benchmarkLabel: 'SDG 2030 target',
    note: 'PFMO national · facility-based, not yet split BHCPF vs. non-BHCPF.',
  },
  'Under-5 Mortality Rate - BHCPF vs. non-BHCPF facilities': {
    unit: 'per 1,000 live births',
    max: 12,
    color: '#5B7089',
    note: 'Facility-recorded institutional ratio — not a population U5MR.',
  },
};

/** Median of a numeric list (for detecting an incomplete latest month). */
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** First count in a mortality meta string, e.g. "(1,527 maternal deaths ÷ …)" → "1,527". */
function deathsFromMeta(meta: string): string | null {
  const m = decodeHtml(meta).match(/\(([\d,]+)\s+[^)÷]*deaths/i);
  return m ? m[1] : null;
}

export function vizEmbedsValue(name: string): boolean {
  const spec = VIZ_MAP[name];
  return !!spec && EMBEDS_VALUE.has(spec.kind);
}

export function vizFor(name: string): VizSpec | undefined {
  return VIZ_MAP[name];
}

export function isWideViz(name: string): boolean {
  const spec = VIZ_MAP[name];
  return !!spec && WIDE_KINDS.has(spec.kind);
}

/* ------------------------------------------------------------------ *
 * Data helpers (all read REAL measurements; nothing synthesized).
 * ------------------------------------------------------------------ */

/** First number in a display string, honouring ₦/k/m/bn (mirrors the deep-dive). */
function magnitudeOf(display: string, pct: number): number {
  const s = String(display).replace(/,/g, '');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return pct;
  let n = parseFloat(m[0]);
  const after = s.slice((m.index ?? 0) + m[0].length);
  if (/^\s*bn/i.test(after)) n *= 1e9;
  else if (/^\s*m/i.test(after)) n *= 1e6;
  else if (/^\s*k/i.test(after)) n *= 1e3;
  return n;
}

function topStateRows(name: string, top = 5): MiniBarRow[] {
  const hideZero = HIDE_ZERO_DISTRIBUTION_INDICATORS.has(name);
  return Object.entries(stateMeasures(name))
    .map(([label, m]) => ({
      label,
      magnitude: m.num ?? magnitudeOf(m.value, m.pct),
      display: m.value,
      pct: m.pct,
    }))
    .filter((r) => !hideZero || r.magnitude > 0)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, top);
}

/** Ranked rows restricted to the in-scope states (explicit zeros kept, so a
 *  single selected state always yields its bar even when its value is 0). */
function scopedStateRows(name: string, states: string[]): MiniBarRow[] {
  const sm = stateMeasures(name);
  return states
    .map((st) => {
      const m = sm[st];
      if (!m) return null;
      return { label: st, magnitude: m.num ?? magnitudeOf(m.value, m.pct), display: m.value, pct: m.pct };
    })
    .filter((r): r is MiniBarRow => r != null)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 8);
}

const fmtNairaCompact = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `₦${+(v / 1e9).toFixed(1)}bn`;
  if (a >= 1e6) return `₦${+(v / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `₦${+(v / 1e3).toFixed(0)}k`;
  return `₦${Math.round(v)}`;
};

const fmtCountCompact = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`;
  return Math.round(v).toLocaleString('en-US');
};

/** Parse the leading signed number out of a display value ("-99.9%", "3,204 recruited"). */
function numberIn(display: string): number | null {
  const m = String(display).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// Functional status is a composition: L2 (the fully-functional class) is the
// primary green; L1 the lighter green; partial/non-functional the fixed secondary.
const SPLIT4_SEGMENTS = (s: Split4): CompositionSegment[] => [
  { label: 'L2', pct: s.l2, color: CHART_GREEN },
  { label: 'L1', pct: s.l1, color: CHART_GREEN_SOFT },
  { label: 'Partial', pct: s.partial, color: secondaryColor(1) },
  { label: 'Non-functional', pct: s.nonfunc, color: secondaryColor(3) },
];

const round1 = (v: number) => Math.round(v * 10) / 10;

/* ------------------------------------------------------------------ *
 * Renderer.
 * ------------------------------------------------------------------ */

export interface IndicatorVizProps {
  indicator: Indicator;
  spec: VizSpec;
  /** Render the ghost (awaiting-data) variant of the selected chart. */
  ghost?: boolean;
  /** All indicators on the page, for cross-indicator context (funnel, pipeline, causes). */
  siblings: Record<string, Indicator>;
  trends: TrendSeries | null;
  /** Live split for the functional-status composition card. */
  split?: Split4 | null;
  /** Highlight a state in distribution charts when a state-only filter is active. */
  highlightState?: string;
  /** A card-level filter is active (indicator/siblings already carry scoped values). */
  scoped?: boolean;
  /** The states in the active geo scope — ranked state-bar charts narrow to these. */
  scopeStates?: string[];
}

export function IndicatorViz({ indicator: ind, spec, ghost, siblings, trends, split, highlightState, scoped, scopeStates }: IndicatorVizProps) {
  if (ghost) return <GhostIndicatorViz indicator={ind} spec={spec} />;

  switch (spec.kind) {
    case 'composition': {
      if (split) {
        return (
          <MiniCompositionBar
            segments={SPLIT4_SEGMENTS(split)}
            note="Each facility is exactly one class — segments sum to 100% of assessed facilities."
          />
        );
      }
      // A composition preview that went live with a single % (no 4-way data yet).
      return <MiniBullet pct={ind.pct} inverse={ind.inverse} />;
    }

    case 'barSplit': {
      // Functional status as ranked horizontal bars — one bar per class (L2/L1/
      // partial/non-functional), each in its status colour on a fixed 0–100 axis so
      // every bar's length reads as its true share. Each facility is exactly one
      // class, so the shares sum to 100%. Reads individual classes better than a
      // stacked bar or donut.
      if (split) {
        // Ranked highest → smallest share (each class keeps its status colour).
        const segs = SPLIT4_SEGMENTS(split)
          .slice()
          .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
        return (
          <div>
            <MiniStateBars
              rows={segs.map((s) => {
                const pct = round1(s.pct ?? 0);
                return { label: s.label, magnitude: pct, display: `${pct}%`, pct };
              })}
              paletteColors={segs.map((s) => s.color)}
              domainMax={100}
              formatter={(v) => `${v}%`}
            />
            <div className="mt-1 text-[11px] text-muted-2">
              Each facility is exactly one class — shares sum to 100% of assessed facilities.
            </div>
          </div>
        );
      }
      // No 4-way data yet → fall back to the single-% bullet.
      return <MiniBullet pct={ind.pct} inverse={ind.inverse} />;
    }

    case 'stateBarsCount':
    case 'stateBarsNaira': {
      const naira = spec.kind === 'stateBarsNaira';
      // Under a geo scope the SAME ranked-bar chart narrows to the in-scope states
      // (a single state → its one bar) instead of morphing into another chart type.
      const rows = scopeStates ? scopedStateRows(ind.name, scopeStates) : topStateRows(ind.name);
      if (!rows.length) return <MiniBullet pct={ind.pct} inverse={ind.inverse} />;
      return (
        <div>
          {/* Ranked states are a single category → one brand green for every bar. */}
          <MiniStateBars
            rows={rows}
            neutralColor={NEUTRAL_BAR}
            highlight={highlightState}
            formatter={naira ? fmtNairaCompact : fmtCountCompact}
          />
          <div className="mt-1 text-[11px] text-muted-2">
            {scopeStates
              ? `${naira ? '₦ received' : 'Volume'} for the current scope.`
              : `Top states by ${naira ? '₦ received' : 'volume'} — open the deep dive for all.`}
          </div>
        </div>
      );
    }

    case 'bullet': {
      // A REAL reported zero gets the explicit zero-emphasis treatment.
      if (ind.pct <= 0.1 && numberIn(ind.value) === 0) {
        return <MiniZeroBar annotation="a real reported zero, not a data gap — see the info note." />;
      }
      return <MiniBullet pct={ind.pct} inverse={ind.inverse} />;
    }

    case 'radial':
      return (
        <div className="flex w-full flex-col items-center justify-center text-center">
          <div className="relative">
            <RingProgress pct={ind.inverse ? 100 - ind.pct : ind.pct} size={176} thickness={6} color={RADIAL_COLOR} />
            {/* Match the donut charts' centre-text size (23px) so ring % reads consistently. */}
            <span className="absolute inset-0 flex items-center justify-center text-[23px] font-extrabold text-text">
              {round1(ind.pct)}%
            </span>
          </div>
        </div>
      );

    case 'donutBinary': {
      const [yes, no] = spec.donutLabels ?? ['Yes', 'No'];
      const p = round1(ind.pct);
      // A REAL reported zero (not a data gap) reads as a zero-emphasis bar — a donut
      // at 0% would be a meaningless solid "no" ring. The donut returns once non-zero.
      if (spec.zeroEmphasis && ind.pct <= 0.1 && numberIn(ind.value) === 0) {
        return <MiniZeroBar annotation="a real reported zero, not a data gap — see the info note." />;
      }
      // Two categories: primary (yes) = brand green, remainder = faint green.
      return (
        <MiniDonut
          segments={[
            { name: yes, value: p, color: CHART_GREEN },
            { name: no, value: round1(100 - p), color: CHART_GREEN_FAINT },
          ]}
          centerText={`${p}%`}
          centerSub={yes}
        />
      );
    }

    case 'donutFp': {
      const p = round1(ind.pct);
      // Two categories: primary (modern) = brand green, secondary = lighter green.
      return (
        <MiniDonut
          segments={[
            { name: 'Modern methods', value: p, color: CHART_GREEN },
            { name: 'Other methods', value: round1(100 - p), color: CHART_GREEN_SOFT },
          ]}
          centerText={`${p}%`}
          centerSub="Modern methods"
        />
      );
    }

    case 'donutCause': {
      // Ranked cause bars (replaces the redundant per-card donut): every card shows
      // the same maternal-death cause breakdown, with THIS card's cause the primary
      // green bar and the others a muted secondary — comparison reads instantly.
      const own = spec.cause!;
      const rows = Object.entries(CAUSE_INDICATORS)
        .map(([label, indName]) => {
          const sib = label === own ? ind : siblings[indName];
          if (!sib || sib.pct <= 0) return null;
          return { label, value: round1(sib.pct), primary: label === own };
        })
        .filter((r): r is { label: string; value: number; primary: boolean } => !!r)
        .sort((a, b) => b.value - a.value);
      const known = rows.reduce((a, r) => a + r.value, 0);
      if (known < 100) {
        rows.push({ label: 'Other causes', value: round1(100 - known), primary: false });
      }
      return <MiniCauseBars rows={rows} caption="Share of recorded maternal deaths" />;
    }

    case 'gauge':
      return <MiniGauge pct={ind.pct} />;

    case 'pipeline': {
      const part = numberIn(ind.value);
      const pool = spec.poolIndicator ? siblings[spec.poolIndicator] : undefined;
      const total = pool ? numberIn(pool.value) : null;
      if (part == null || total == null || total <= 0) {
        return <MiniBullet pct={ind.pct} inverse={ind.inverse} />;
      }
      return (
        <MiniPipeline
          part={part}
          total={total}
          partLabel={spec.poolLabels?.part ?? 'Part'}
          totalLabel={spec.poolLabels?.total ?? 'Total'}
        />
      );
    }

    case 'kpiStat': {
      // `trends` is the scoped series under a filter (see IndicatorCard / KpiStrip), so
      // the sparkline + delta rescope with the headline value. A scope with no delivery
      // history falls back to the plain stat.
      const series = spec.trendKey && trends ? trends[spec.trendKey] : undefined;
      const vals = (series ?? []).filter((v): v is number => v != null);
      if (!vals.length) return <MiniKpiStat value={decodeHtml(ind.value)} boxed />;
      const recent = vals.slice(-6);
      // The latest month is often still reporting — flag it so the delta isn't
      // misread as a real collapse; compute it over completed months only.
      const priorMed = median(recent.slice(0, -1));
      const partialLast = recent.length >= 3 && recent[recent.length - 1] < 0.4 * priorMed;
      const stable = partialLast ? recent.slice(0, -1) : recent;
      let deltaText: string | undefined;
      let deltaDir: 'up' | 'down' | undefined;
      if (stable.length >= 2) {
        const diff = stable[stable.length - 1] - stable[0];
        const pctChange = stable[0] ? (diff / stable[0]) * 100 : 0;
        deltaDir = diff >= 0 ? 'up' : 'down';
        deltaText = `${diff >= 0 ? '+' : ''}${round1(pctChange)}% across recent months`;
      }
      // The headline aggregate sits centred in its own inner card (no trend line).
      return <MiniKpiStat value={decodeHtml(ind.value)} deltaText={deltaText} deltaDir={deltaDir} boxed />;
    }

    case 'funnel': {
      const anc1 = siblings['% of women with a live birth who attended ANC 1'];
      if (!anc1 || anc1.pct <= 0) return <MiniBullet pct={ind.pct} inverse={ind.inverse} />;
      return (
        <MiniFunnel
          stages={[
            { label: 'ANC 1', pct: round1(anc1.pct) },
            { label: 'ANC 4', pct: round1(ind.pct) },
          ]}
        />
      );
    }

    case 'delta': {
      const d = numberIn(ind.value);
      if (d == null) return null;
      return <MiniDeltaBar delta={d} />;
    }

    case 'rateBar': {
      const cfg = RATE_CFG[ind.name];
      const v = numberIn(ind.value) ?? 0;
      if (!cfg) return <MiniKpiStat value={decodeHtml(ind.value)} />;
      // With a published target we compare the two rates directly (reads instantly).
      if (cfg.benchmark != null) {
        const ratio = cfg.benchmark ? v / cfg.benchmark : 0;
        return (
          <MiniCompareBars
            rows={[
              { label: 'Facility-based (national)', value: v, color: cfg.color },
              { label: cfg.benchmarkLabel ?? 'Target', value: cfg.benchmark, color: CHART_GREEN },
            ]}
            unit={cfg.unit}
            verdict={
              ratio > 1
                ? `${round1(ratio)}× the ${cfg.benchmarkLabel ?? 'target'} of ${cfg.benchmark}`
                : `At or below the ${cfg.benchmarkLabel ?? 'target'} of ${cfg.benchmark}`
            }
            verdictTone={ratio > 1 ? 'bad' : 'good'}
          />
        );
      }
      // No comparable benchmark (e.g. an institutional ratio) — plot the rate on its
      // contextual 0–max scale so the magnitude reads without a misleading target.
      const deaths = scoped ? null : deathsFromMeta(ind.meta);
      return (
        <MiniRateBar
          value={v}
          unit={cfg.unit}
          max={cfg.max}
          color={cfg.color}
          note={deaths ? `${cfg.note} · ${deaths} recorded deaths.` : cfg.note}
        />
      );
    }

    default:
      return null;
  }
}

/** Ghost (awaiting-data) variant: the intended chart's shape, zero numbers. */
function GhostIndicatorViz({ indicator: ind, spec }: { indicator: Indicator; spec: VizSpec }) {
  const message = `Source: ${decodeHtml(ind.src)} — not yet connected.`;

  const shape = (() => {
    switch (spec.kind) {
      case 'composition':
        return (
          <MiniCompositionBar
            ghost
            highlight={spec.ghostHighlight}
            segments={(spec.ghostSegments ?? ['L2', 'L1', 'Partial', 'Non-functional']).map((label) => ({
              label,
              color: '',
            }))}
            note={spec.ghostNote}
          />
        );
      case 'stateBarsCount':
      case 'stateBarsNaira':
        return <MiniStateBars ghost rows={[]} ghostLabels={['Ranked states', 'will appear', 'here', '…']} />;
      case 'barSplit':
        return <MiniStateBars ghost rows={[]} ghostLabels={['L2', 'L1', 'Partial', 'Non-functional']} />;
      case 'donutBinary':
      case 'donutCause':
      case 'donutFp':
        return <MiniDonut ghost segments={[]} height={104} />;
      case 'gauge':
        return <MiniGauge ghost />;
      case 'radial':
        return (
          <div className="flex w-full flex-col items-center justify-center gap-2 text-center">
            {/* Ghost ring stays fully muted (no brand colour) so it reads as pending. */}
            <RingProgress pct={0} size={140} thickness={5} color="rgb(128,138,150)" />
            <span className="text-[12px] text-muted-2">Coverage % once connected</span>
          </div>
        );
      case 'bullet':
      default:
        return <MiniBullet ghost />;
    }
  })();

  return <GhostViz message={message}>{shape}</GhostViz>;
}
