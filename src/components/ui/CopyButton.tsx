import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { cn } from '@/lib/cn';

/**
 * Copies a ready-to-paste citation (value + source + period) to the clipboard —
 * for dropping a figure straight into a report, email or briefing. Used on KPI
 * cards and indicator deep-dive rows.
 */
export function CopyButton({
  text,
  label = 'Copy citation',
  className,
  compact,
  stopPropagation,
}: {
  text: string;
  label?: string;
  className?: string;
  /** Icon-only, smaller — for tight spots like a card corner. */
  compact?: boolean;
  /** Prevent the click from bubbling to a clickable parent (e.g. a routed card). */
  stopPropagation?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useNotificationStore((s) => s.toast);

  const onClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast({ tone: 'success', title: 'Copied', description: 'Figure copied to the clipboard.' });
    } catch {
      toast({ tone: 'error', title: 'Copy failed', description: 'Clipboard access was blocked.' });
    }
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg text-muted transition-colors hover:bg-bg-elev-2 hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60',
        compact ? 'h-7 w-7 justify-center' : 'h-8 border border-border px-2.5 text-xs font-semibold',
        copied && 'text-brand-bright',
        className
      )}
    >
      <Icon size={compact ? 14 : 14} />
      {!compact && (copied ? 'Copied' : 'Cite')}
    </button>
  );
}
