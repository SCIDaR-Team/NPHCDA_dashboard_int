import { cn } from '@/lib/cn';

/** NPHCDA brand mark — a stylised PHC cross in the brand green. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn('flex-shrink-0', className)}
      role="img"
      aria-label="NPHCDA"
    >
      <defs>
        <linearGradient id="nphcda-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10C46E" />
          <stop offset="1" stopColor="#007A45" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#nphcda-g)" />
      <path d="M22.5 8h-5v9.5H8v5h9.5V32h5v-9.5H32v-5h-9.5V8Z" fill="#fff" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={compact ? 30 : 34} />
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-text">NPHCDA Dashboard</div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">
            PHC Performance &amp; Decision Support
          </div>
        </div>
      )}
    </div>
  );
}
