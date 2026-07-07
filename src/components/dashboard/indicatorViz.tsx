import { RingProgress } from '@/components/charts/RingProgress';
import {
  MiniBullet,
  MiniCompositionBar,
  MiniPipeline,
  MiniFunnel,
  MiniDeltaBar,
  MiniZeroBar,
  MiniKpiStat,
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
import { stateMeasures, heatColor } from '@/data/calculations';
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

const NEUTRAL_BAR = '#3D7BB5'; // counts are not graded good/bad

const CAUSE_COLORS: Record<string, string> = {
  PPH: '#C2562C',
  'Pre-eclampsia/eclampsia': '#C9A227',
  Sepsis: '#7A4FA8',
};
const CAUSE_INDICATORS: Record<string, string> = {
  PPH: 'Proportion of maternal deaths resulting from PPH',
  'Pre-eclampsia/eclampsia': 'Proportion of maternal deaths resulting from pre-eclampsia/eclampsia',
  Sepsis: 'Proportion of maternal deaths resulting from sepsis',
};

const VACCINE_BANDS = ['Sufficient (50–80%)', 'Reorder (25–50%)', 'Understocked (<25%)', 'Stocked out'];
const BAND_NOTE = 'This card measures the highlighted band of the vaccine stock distribution.';

export const VIZ_MAP: Record<string, VizSpec> = {
  /* ---------------- Facility Readiness ---------------- */
  'Facility functional status per state (L1 / L2 / partial / non-functional)': { kind: 'composition' },
  'Number of revitalized PHC facilities per state': { kind: 'stateBarsCount' },
  'Proportion of visited PHCs offering the full essential service package*': { kind: 'bullet' },
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
  '% of recruited CBHWs that have been absorbed': { kind: 'bullet' }, // renders zero-emphasis at a real 0
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
  'Proportion of PHCs with all six tracer commodities available*': { kind: 'bullet' },
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
  'Proportion of children &lt;1 year who received Penta 3': { kind: 'bullet' },
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
const WIDE_KINDS = new Set<VizKind>(['composition', 'stateBarsCount', 'stateBarsNaira']);

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

/** Distinct-but-harmonious hues so each state's bar reads as its own. */
const STATE_PALETTE = ['#3D7BB5', '#2E8B57', '#C9A227', '#C2562C', '#7A4FA8', '#2A9D8F', '#D1495B', '#5B7089'];

/** Radial (saturation %) rings use a fixed brand colour, not the heat scale. */
const RADIAL_COLOR = '#3D7BB5';

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
    benchmarkLabel: 'SDG 2030 target · 70',
    note: 'PFMO national · facility-based, not yet split BHCPF vs. non-BHCPF.',
  },
  'Under-5 Mortality Rate - BHCPF vs. non-BHCPF facilities': {
    unit: 'per 1,000 live births',
    max: 12,
    color: '#5B7089',
    note: 'Institutional ratio (facility-recorded deaths ÷ live births) — not a population U5MR.',
  },
};

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

const SPLIT4_SEGMENTS = (s: Split4): CompositionSegment[] => [
  { label: 'L2', pct: s.l2, color: '#2E8B57' },
  { label: 'L1', pct: s.l1, color: '#6FA888' },
  { label: 'Partial', pct: s.partial, color: '#C9A227' },
  { label: 'Non-functional', pct: s.nonfunc, color: '#C2562C' },
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
}

export function IndicatorViz({ indicator: ind, spec, ghost, siblings, trends, split, highlightState }: IndicatorVizProps) {
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

    case 'stateBarsCount':
    case 'stateBarsNaira': {
      const rows = topStateRows(ind.name);
      const naira = spec.kind === 'stateBarsNaira';
      if (!rows.length) return <MiniBullet pct={ind.pct} inverse={ind.inverse} />;
      return (
        <div>
          <MiniStateBars
            rows={rows}
            neutralColor={naira ? NEUTRAL_BAR : undefined}
            paletteColors={naira ? undefined : STATE_PALETTE}
            highlight={highlightState}
            formatter={naira ? fmtNairaCompact : fmtCountCompact}
          />
          <div className="mt-1 text-[10px] text-muted-2">
            Top states by {naira ? '₦ received' : 'volume'} — open the deep dive for all.
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
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <RingProgress pct={ind.inverse ? 100 - ind.pct : ind.pct} size={110} thickness={5} color={RADIAL_COLOR} />
            <span className="absolute inset-0 flex items-center justify-center text-[23px] font-extrabold text-text">
              {round1(ind.pct)}%
            </span>
          </div>
          <div className="min-w-0 text-[11px] leading-snug text-muted">
            {ind.pct >= 99.5 ? (
              <>
                <b className="text-text-soft">At ceiling.</b> Read with the source caveat in the info note.
              </>
            ) : (
              <>
                of the <b className="text-text-soft">100%</b> target
              </>
            )}
          </div>
        </div>
      );

    case 'donutBinary': {
      const [yes, no] = spec.donutLabels ?? ['Yes', 'No'];
      const p = round1(ind.pct);
      return (
        <MiniDonut
          segments={[
            { name: yes, value: p, color: heatColor(ind.inverse ? 100 - p : p) },
            { name: no, value: round1(100 - p), color: 'rgba(194,86,44,0.5)' },
          ]}
          centerText={`${p}%`}
          centerSub={yes.toLowerCase()}
        />
      );
    }

    case 'donutFp': {
      const p = round1(ind.pct);
      return (
        <MiniDonut
          segments={[
            { name: 'Modern methods', value: p, color: '#2E8B57' },
            { name: 'Other methods', value: round1(100 - p), color: 'rgba(122,79,168,0.55)' },
          ]}
          centerText={`${p}%`}
          centerSub="modern"
        />
      );
    }

    case 'donutCause': {
      const own = spec.cause!;
      const segments = Object.entries(CAUSE_INDICATORS)
        .map(([label, indName]) => {
          const sib = label === own ? ind : siblings[indName];
          if (!sib || sib.pct <= 0) return null;
          return {
            name: label,
            value: round1(sib.pct),
            color: CAUSE_COLORS[label],
            dim: label !== own,
          };
        })
        .filter((s): s is NonNullable<typeof s> => !!s);
      const known = segments.reduce((a, s) => a + s.value, 0);
      if (known < 100) {
        segments.push({
          name: 'Other causes',
          value: round1(100 - known),
          color: 'rgba(128,138,150,0.35)',
          dim: true,
        });
      }
      return <MiniDonut segments={segments} centerText={`${round1(ind.pct)}%`} centerSub={own} />;
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
      const series = spec.trendKey && trends ? trends[spec.trendKey] : undefined;
      const vals = (series ?? []).filter((v): v is number => v != null);
      let deltaText: string | undefined;
      let deltaDir: 'up' | 'down' | undefined;
      if (vals.length >= 2) {
        const diff = vals[vals.length - 1] - vals[0];
        const pctChange = vals[0] ? (diff / vals[0]) * 100 : 0;
        deltaDir = diff >= 0 ? 'up' : 'down';
        deltaText = `${diff >= 0 ? '+' : ''}${round1(pctChange)}% over the reported period`;
      }
      return (
        <MiniKpiStat
          value={decodeHtml(ind.value)}
          sub="Latest reporting month · facility-based volume"
          deltaText={deltaText}
          deltaDir={deltaDir}
        />
      );
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
      return (
        <MiniRateBar
          value={v}
          unit={cfg.unit}
          max={cfg.max}
          color={cfg.color}
          benchmark={cfg.benchmark}
          benchmarkLabel={cfg.benchmarkLabel}
          note={cfg.note}
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
      case 'donutBinary':
      case 'donutCause':
      case 'donutFp':
        return <MiniDonut ghost segments={[]} height={104} />;
      case 'gauge':
        return <MiniGauge ghost />;
      case 'radial':
        return (
          <div className="flex items-center gap-4">
            <RingProgress pct={0} size={110} thickness={5} color={RADIAL_COLOR} />
            <span className="text-[11px] text-muted-2">Coverage % once connected</span>
          </div>
        );
      case 'bullet':
      default:
        return <MiniBullet ghost />;
    }
  })();

  return <GhostViz message={message}>{shape}</GhostViz>;
}
