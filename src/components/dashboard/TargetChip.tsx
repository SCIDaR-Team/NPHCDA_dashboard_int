import { Tooltip } from '@/components/ui';
import { varianceFor, TARGET_SOURCE_NOTE } from '@/data/targets';

/**
 * Target / variance chip: "Target 95% · −8.6 pts", the variance coloured green when
 * the scope is at/above the national target and red when below. Renders nothing when
 * the indicator has no target or no usable percentage, so it's safe to drop onto any
 * card. The tooltip names the target as a policy benchmark (not measured data).
 */
export function TargetChip({
  indicatorName,
  actualPct,
  className = '',
}: {
  indicatorName: string;
  actualPct: number | undefined;
  className?: string;
}) {
  const v = varianceFor(indicatorName, actualPct);
  if (!v) return null;
  const sign = v.delta > 0 ? '+' : '';
  return (
    <Tooltip content={<span className="leading-relaxed">{TARGET_SOURCE_NOTE}</span>}>
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-bg-elev-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums ${className}`}
      >
        <span className="text-muted">Target {v.target}%</span>
        <span className={v.meets ? 'text-[#2e8b57]' : 'text-[#c2562c]'}>
          {sign}
          {v.delta} pts
        </span>
      </span>
    </Tooltip>
  );
}
