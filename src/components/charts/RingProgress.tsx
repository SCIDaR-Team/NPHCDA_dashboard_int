import { heatColor } from '@/data/calculations';

interface RingProps {
  pct: number;
  inverse?: boolean;
  size?: number;
  /** Stroke width in the 36-unit viewBox space (default 3). */
  thickness?: number;
  /** Fixed ring colour; when omitted the preserved heat scale is used. */
  color?: string;
}

/** Circular progress ring coloured by the preserved heat scale (or a fixed colour). */
export function RingProgress({ pct, inverse, size = 46, thickness = 3, color: colorProp }: RingProps) {
  const r = 18 - thickness / 2 - 1;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const color = colorProp ?? heatColor(inverse ? 100 - clamped : clamped);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-bg-elev-3" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * circ} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}
