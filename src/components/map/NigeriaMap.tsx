import { useState } from 'react';
import { STATE_PATHS, STATE_CENTROIDS, STATE_DONORS, MAP_VBW, MAP_VBH } from '@/data/geo/states';
import { heatColor } from '@/data/calculations';
import { cssVar } from '@/components/charts/chartTheme';
import { useThemeStore } from '@/store/themeStore';

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
}

interface DonorMarkerProps {
  cx: number;
  cy: number;
  donor: string;
}

function DonorMarker({ cx, cy, donor }: DonorMarkerProps) {
  if (donor === 'Gates Foundation')
    return (
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="9" fill="#FFD166" pointerEvents="none">
        ★
      </text>
    );
  if (donor === 'EU-UNFPA')
    return <polygon points={`${cx},${cy - 4} ${cx - 4},${cy + 4} ${cx + 4},${cy + 4}`} fill="#7030A0" pointerEvents="none" />;
  if (donor === 'CIFF') return <circle cx={cx} cy={cy} r={3.5} fill="#C9D11A" pointerEvents="none" />;
  if (donor === 'LAD')
    return <rect x={cx - 3.2} y={cy - 3.2} width={6.4} height={6.4} fill="none" stroke="#2F9A41" strokeWidth={1.4} pointerEvents="none" />;
  return null;
}

export function NigeriaMap({ values, selected, highlight, onStateClick }: NigeriaMapProps) {
  const [hover, setHover] = useState<{ state: string; x: number; y: number } | null>(null);
  // Subscribe to the theme so the map recolours on dark/light toggle; the neutral
  // surfaces (no-data fill, inter-state stroke, label halo) come from theme tokens.
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const noDataFill = cssVar('--c-bg-elev-3');
  const stateStroke = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.35)';
  const labelFill = isDark ? cssVar('--c-text') : '#10203A';
  const labelHalo = isDark ? cssVar('--c-bg') : 'rgba(255,255,255,0.9)';

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 560 }}>
      <svg
        viewBox={`0 0 ${MAP_VBW} ${MAP_VBH}`}
        className="h-auto w-full"
        style={{ maxHeight: 400 }}
        role="img"
        aria-label="Nigeria states performance map"
      >
        {Object.entries(STATE_PATHS).map(([state, d]) => {
          const v = values[state];
          const hasData = v !== undefined;
          const dim = highlight && !highlight.includes(state);
          const isSel = selected === state;
          return (
            <path
              key={state}
              d={d}
              fill={hasData ? heatColor(v) : noDataFill}
              stroke={isSel ? '#fff' : stateStroke}
              strokeWidth={isSel ? 1.8 : 0.6}
              opacity={dim ? 0.25 : 1}
              className="cursor-pointer transition-[opacity,stroke-width] duration-150 hover:opacity-90"
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ state, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ state, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={() => onStateClick?.(state)}
            />
          );
        })}

        {/* Donor markers — nudged above the centroid so the state label stays clear. */}
        {Object.entries(STATE_DONORS).map(([state, donors]) => {
          const c = STATE_CENTROIDS[state];
          if (!c) return null;
          return donors.map((donor, i) => (
            <DonorMarker key={state + donor} cx={c[0] + (i - (donors.length - 1) / 2) * 9} cy={c[1] - 10} donor={donor} />
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
          <div className="mt-0.5 text-[10px] text-muted-2">Click for full profile</div>
        </div>
      )}
    </div>
  );
}

/** Compact legend for the map (performance scale + donor markers). */
export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
      <span className="flex items-center gap-2">
        <span className="font-semibold text-text-soft">Performance</span>
        <span
          className="h-2.5 w-24 rounded-full"
          style={{ background: 'linear-gradient(90deg, #C2562C, #C9A227, #2E8B57)' }}
        />
        <span>Low → High</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="font-semibold text-text-soft">Donors</span>
        <span className="flex items-center gap-1"><span style={{ color: '#FFD166' }}>★</span>Gates</span>
        <span className="flex items-center gap-1">
          <svg width="9" height="9"><polygon points="4.5,0 0,9 9,9" fill="#7030A0" /></svg>EU-UNFPA
        </span>
        <span className="flex items-center gap-1">
          <svg width="9" height="9"><circle cx="4.5" cy="4.5" r="4.5" fill="#C9D11A" /></svg>CIFF
        </span>
        <span className="flex items-center gap-1">
          <svg width="9" height="9"><rect x="0.5" y="0.5" width="8" height="8" fill="none" stroke="#2F9A41" strokeWidth="1.4" /></svg>LAD
        </span>
      </span>
    </div>
  );
}
