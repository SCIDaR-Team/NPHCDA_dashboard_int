import { heatColor } from '@/data/calculations';

interface RingProps {
  pct: number;
  inverse?: boolean;
  size?: number;
}

/** Circular progress ring coloured by the preserved heat scale. */
export function RingProgress({ pct, inverse, size = 46 }: RingProps) {
  const r = 15.5;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const color = heatColor(inverse ? 100 - clamped : clamped);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-bg-elev-3" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * circ} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}
