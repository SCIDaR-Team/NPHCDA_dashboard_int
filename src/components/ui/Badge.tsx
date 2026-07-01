import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import type { StatusInfo } from '@/data/calculations';

type Tone = 'brand' | 'neutral' | 'danger' | 'warning' | 'info' | 'good' | 'mid' | 'poor';

const tones: Record<Tone, string> = {
  brand: 'bg-brand/12 text-brand-bright border-brand/25',
  neutral: 'bg-bg-elev-2 text-muted border-border',
  danger: 'bg-danger/12 text-danger border-danger/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  info: 'bg-info/12 text-info border-info/25',
  good: 'bg-[#2E8B57]/14 text-[#34a76b] border-[#2E8B57]/30',
  mid: 'bg-[#C9A227]/14 text-[#cead3a] border-[#C9A227]/30',
  poor: 'bg-[#C2562C]/14 text-[#d2693c] border-[#C2562C]/30',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/** Status pill driven by the preserved good/mid/poor logic. */
export function StatusPill({ status }: { status: StatusInfo }) {
  return <Badge tone={status.level}>{status.label}</Badge>;
}
