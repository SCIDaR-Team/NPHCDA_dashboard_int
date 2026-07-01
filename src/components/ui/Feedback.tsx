import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={cn('animate-spin text-brand', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elev-2 text-muted">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-sm font-bold text-text">{title}</h3>
        {description && <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/12 text-2xl">
        ⚠️
      </div>
      <div>
        <h3 className="text-sm font-bold text-text">Something went wrong</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-bg-elev-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}
