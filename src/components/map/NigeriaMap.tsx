import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { STATE_PATHS, STATE_CENTROIDS, STATE_DONORS, MAP_VBW, MAP_VBH } from '@/data/geo/states';
import { heatColor, heatGradientCss } from '@/data/calculations';
import { cssVar } from '@/components/charts/chartTheme';
import { useThemeStore } from '@/store/themeStore';
import { PROFILE_INDICATOR_NAMES } from './stateProfile';
import { cleanName } from '@/lib/format';

/** Short labels for the longer names so the crowded southern cluster stays legible. */
const STATE_LABELS: Record<string, string> = {
  'Akwa Ibom': 'A. Ibom',
  'Cross River': 'C. River',
  Nasarawa: 'Nasar.',
};

interface NigeriaMapProps {
  /** 0–100 performance value per state (drives fill colour). A state absent from this
   *  map has no real measurement for the current selection → painted as "no data". */
  values: Record<string, number>;
  selected?: string;
  /** States to keep highlighted; others dim (e.g. an active filter). */
  highlight?: string[] | null;
  /** Click a state (opens its cross-block profile in the Overview). */
  onStateClick?: (state: string) => void;
  /** Clear the current state selection — fired by clicking the already-selected
   *  state again, or clicking empty space on the map. */
  onClearSelection?: () => void;
}

interface DonorMarkerProps {
  cx: number;
  cy: number;
  donor: string;
  /** 1 = full size. Scaled down on small states so the symbol stays inside its own borders. */
  scale: number;
}

/** A dark outline keeps the markers readable on both light and dark state fills. */
const MARKER_STROKE = 'rgba(0,0,0,0.55)';

/** Half-width of a full-size marker, in viewBox units. */
const MARKER_R = 7.5;

/**
 * States whose footprint on this projection is too small to carry a full-size marker
 * without spilling over a neighbour — mostly the southern cluster. Only states that
 * actually have donors need listing.
 */
const SMALL_STATES = new Set([
  'Lagos', 'Bayelsa', 'Abia', 'Anambra', 'Ebonyi', 'Enugu', 'Ekiti', 'Akwa Ibom', 'Gombe', 'Nasarawa', 'Kogi',
]);

function DonorMarker({ cx, cy, donor, scale }: DonorMarkerProps) {
  const r = MARKER_R * scale;
  if (donor === 'Gates Foundation')
    return (
      <text
        x={cx}
        y={cy + r}
        textAnchor="middle"
        fontSize={r * 2.7}
        fill="#FFD166"
        pointerEvents="none"
        style={{ paintOrder: 'stroke', stroke: MARKER_STROKE, strokeWidth: 1.1, strokeLinejoin: 'round' }}
      >
        ★
      </text>
    );
  if (donor === 'EU-UNFPA')
    return (
      <polygon
        points={`${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`}
        fill="#7030A0"
        stroke={MARKER_STROKE}
        strokeWidth={0.7}
        pointerEvents="none"
      />
    );
  if (donor === 'CIFF')
    return <circle cx={cx} cy={cy} r={r * 0.92} fill="#C9D11A" stroke={MARKER_STROKE} strokeWidth={0.7} pointerEvents="none" />;
  if (donor === 'LAD')
    return (
      <rect
        x={cx - r * 0.9}
        y={cy - r * 0.9}
        width={r * 1.8}
        height={r * 1.8}
        fill="none"
        stroke="#2F9A41"
        strokeWidth={2 * scale}
        pointerEvents="none"
      />
    );
  return null;
}

export function NigeriaMap({ values, selected, highlight, onStateClick, onClearSelection }: NigeriaMapProps) {
  const [hover, setHover] = useState<{ state: string; x: number; y: number } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  // Subscribe to the theme so the map recolours on dark/light toggle; the neutral
  // surfaces (no-data fill, inter-state stroke, label halo) come from theme tokens.
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const noDataFill = cssVar('--c-bg-elev-3');
  const stateStroke = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.35)';
  const labelFill = isDark ? cssVar('--c-text') : '#10203A';
  const labelHalo = isDark ? cssVar('--c-bg') : 'rgba(255,255,255,0.9)';

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 640 }}>
      <svg
        viewBox={`0 0 ${MAP_VBW} ${MAP_VBH}`}
        className="h-auto w-full"
        style={{ maxHeight: 492 }}
        role="img"
        aria-label="Nigeria states performance map"
        // A click that lands on empty map space (not on a state path) clears the
        // current selection — no need to reopen the General Filter to reset.
        onClick={(e) => {
          if (e.target === e.currentTarget && selected) onClearSelection?.();
        }}
      >
        {Object.entries(STATE_PATHS).map(([state, d]) => {
          const v = values[state];
          const hasData = v !== undefined;
          const dim = highlight && !highlight.includes(state);
          const isSel = selected === state;
          const isFocused = focused === state;
          const outlined = isSel || isFocused;
          return (
            <path
              key={state}
              d={d}
              fill={hasData ? heatColor(v) : noDataFill}
              stroke={outlined ? '#fff' : stateStroke}
              strokeWidth={outlined ? 1.8 : 0.6}
              opacity={dim ? 0.25 : 1}
              tabIndex={0}
              role="button"
              aria-label={`${state}${
                hasData ? `, performance ${Math.round(v)} of 100` : ', no data for this selection'
              }${selected === state ? ', selected' : ''}. Activate for full profile.`}
              className="cursor-pointer outline-none transition-[opacity,stroke-width] duration-150 hover:opacity-90"
              onFocus={() => setFocused(state)}
              onBlur={() => setFocused(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isSel) onClearSelection?.();
                  else onStateClick?.(state);
                }
              }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ state, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ state, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                // Clicking the already-selected state toggles it off; any other
                // state opens its profile as before.
                if (isSel) onClearSelection?.();
                else onStateClick?.(state);
              }}
            />
          );
        })}

        {/* Donor markers — nudged above the centroid so the state label stays clear.
            Size and the gap between co-located markers both scale down on small
            states, so a two-donor pair stays within its own borders. */}
        {Object.entries(STATE_DONORS).map(([state, donors]) => {
          const c = STATE_CENTROIDS[state];
          if (!c) return null;
          const scale = SMALL_STATES.has(state) ? 0.85 : 1;
          const gap = MARKER_R * 2.1 * scale;
          return donors.map((donor, i) => (
            <DonorMarker
              key={state + donor}
              cx={c[0] + (i - (donors.length - 1) / 2) * gap}
              // Nudge tracks marker size so a larger symbol clears the label without
              // being flung toward the state edge; keeps the marker inside its border.
              cy={c[1] - (MARKER_R * scale + 1.5)}
              donor={donor}
              scale={scale}
            />
          ));
        })}

        {/* State name labels — dark text with a white halo so they stay legible on any fill. */}
        {Object.entries(STATE_CENTROIDS).map(([state, [cx, cy]]) => (
          <text
            key={`lbl-${state}`}
            x={cx}
            y={cy + 3}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={labelFill}
            pointerEvents="none"
            style={{
              paintOrder: 'stroke',
              stroke: labelHalo,
              strokeWidth: 2.4,
              strokeLinejoin: 'round',
            }}
          >
            {STATE_LABELS[state] ?? state}
          </text>
        ))}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-bg-elev px-3 py-1.5 text-xs shadow-pop"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <div className="font-bold text-text">{hover.state}</div>
          <div className="text-muted">
            {values[hover.state] !== undefined ? (
              <>
                Value: <span className="font-semibold text-text-soft">{Math.round(values[hover.state])}</span>
              </>
            ) : (
              <span className="italic">No data for this selection</span>
            )}
            {STATE_DONORS[hover.state]?.length ? ` · ${STATE_DONORS[hover.state].join(', ')}` : ''}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-2">
            {selected === hover.state ? 'Click to clear selection' : 'Click for full profile'}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The "Multi-indicator Performance" legend label doubles as an affordance: clicking it
 * opens a small panel that spells out every indicator feeding the composite map score
 * and the share each one contributes. The score is an equal-weighted average, so every
 * indicator carries the same share (1 / N); per state the average is taken only over the
 * indicators that have data, so a missing one simply raises the others' share.
 */
function PerformanceLegendPopover() {
  const [open, setOpen] = useState(false);
  // Panel placement is decided from the trigger's viewport position when it opens, so
  // the popover works whether the legend sits at the bottom of the card or off to the
  // side — it always opens toward the roomier direction instead of off-screen.
  const [dropUp, setDropUp] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const share = (100 / PROFILE_INDICATOR_NAMES.length).toFixed(1);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropUp(r.bottom > window.innerHeight * 0.55);
      setAlignRight(r.left > window.innerWidth * 0.6);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="See the indicators behind the composite score"
        className="flex items-center gap-1 whitespace-nowrap rounded font-semibold text-text-soft underline decoration-dotted underline-offset-2 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        Multi-indicator Performance
        <Info size={12} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Indicators behind the composite performance score"
          // Width is pinned inline so long indicator names wrap inside the panel.
          // whitespace-normal resets the `nowrap` the panel would otherwise inherit
          // from the legend's single-line performance row — that inheritance was what
          // made the names overflow across the map.
          style={{ width: 360, maxWidth: '85vw', maxHeight: '80vh' }}
          className={`absolute z-30 overflow-y-auto overscroll-contain whitespace-normal rounded-xl border border-border bg-bg-elev-2 p-3.5 text-left shadow-2xl ${
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${alignRight ? 'right-0' : 'left-0'}`}
        >
          <p className="text-[13px] font-bold text-text">Multi-indicator Performance</p>
          <p className="mb-3 mt-0.5 text-[12px] leading-snug text-muted">
            An equal-weighted average of {PROFILE_INDICATOR_NAMES.length} indicators — each carries the
            same share. Per state, the average is taken over the indicators that have data.
          </p>
          <ul className="space-y-1.5">
            {PROFILE_INDICATOR_NAMES.map((name) => (
              <li key={name} className="flex items-start justify-between gap-3 text-[12px]">
                <span className="min-w-0 leading-snug text-text-soft">{cleanName(name)}</span>
                <span className="shrink-0 font-semibold tabular-nums text-brand">{share}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}

/** Donor swatch rows — shared between the row and column legend layouts. Swatch sizes
 *  are kept close to the legend text so the strip reads as one consistent size. */
const DONOR_SWATCHES = (
  <>
    <span className="flex items-center gap-1.5">
      <span className="text-[16px] leading-none" style={{ color: '#FFD166' }}>★</span>Gates
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="15" height="15" aria-hidden><polygon points="7.5,0.5 0.5,14.5 14.5,14.5" fill="#7030A0" /></svg>EU-UNFPA
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="15" height="15" aria-hidden><circle cx="7.5" cy="7.5" r="6.4" fill="#C9D11A" /></svg>CIFF
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="15" height="15" aria-hidden><rect x="1.2" y="1.2" width="12.6" height="12.6" fill="none" stroke="#2F9A41" strokeWidth="2.3" /></svg>LAD
    </span>
  </>
);

/**
 * Compact legend for the map (performance scale + donor markers).
 * `layout="column"` stacks it into a vertical rail so it can sit beside the map
 * instead of below it; the default row layout keeps the original inline strip.
 * In both layouts the performance label, gradient bar and "Low → High" stay on one
 * unbroken line.
 */
export function MapLegend({ layout = 'row' }: { layout?: 'row' | 'column' }) {
  const column = layout === 'column';
  return (
    <div
      className={
        column
          ? 'flex flex-col gap-3.5 text-[12px] text-muted'
          : 'flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted'
      }
    >
      <span className="flex items-center gap-2 whitespace-nowrap">
        <PerformanceLegendPopover />
        <span className="h-2 w-16 shrink-0 rounded-full" style={{ background: heatGradientCss() }} />
        <span>Low → High</span>
      </span>
      <span className={column ? 'flex flex-col gap-1.5' : 'flex items-center gap-4'}>
        <span className="font-semibold text-text-soft">Donors</span>
        {DONOR_SWATCHES}
      </span>
    </div>
  );
}
