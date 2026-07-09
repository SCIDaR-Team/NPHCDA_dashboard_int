import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DropdownItem {
  key: string;
  label: string;
  /** Optional swatch (e.g. the trend-series line colour). */
  color?: string;
}
export interface DropdownGroup {
  label: string;
  items: DropdownItem[];
}

/**
 * Compact multi-select disclosure: a trigger button that opens a popover of
 * checkbox items organised under group headers. Keeps long, grouped pickers (trend
 * series, deep-dive columns) from consuming vertical space while still exposing the
 * grouping — collapsed by default, closes on outside click / Escape.
 *
 * `open`/`onOpenChange` make it optionally controlled, so a row of these can share a
 * single "one open at a time" coordinator (see GroupedDropdownBar). Selections live
 * in the caller's shared set, so picks accumulate across dropdowns regardless of
 * which popover is open.
 */
export function MultiSelectDropdown({
  buttonLabel,
  summary,
  groups,
  isChecked,
  onToggle,
  align = 'left',
  panelWidth = 'w-72',
  hideGroupHeader = false,
  hasSelection = false,
  open: openProp,
  onOpenChange,
}: {
  buttonLabel: string;
  /** Small muted count shown next to the label, e.g. "3 of 10" or "· 2". */
  summary?: string;
  groups: DropdownGroup[];
  isChecked: (key: string) => boolean;
  onToggle: (key: string) => void;
  align?: 'left' | 'right';
  /** Tailwind width class for the popover panel. */
  panelWidth?: string;
  /** Skip the in-popover group header (the button already names a single group). */
  hideGroupHeader?: boolean;
  /** Keep a brand outline when the group has active selections but is closed. */
  hasSelection?: boolean;
  /** Controlled open state; omit for an internally-managed dropdown. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [flip, setFlip] = useState(false); // open leftward when the button sits in the right half
  const controlled = openProp !== undefined;
  const open = controlled ? openProp! : internalOpen;
  const setOpen = (v: boolean) => (controlled ? onOpenChange?.(v) : setInternalOpen(v));
  const ref = useRef<HTMLDivElement>(null);

  // Decide alignment from the button's position so the panel never spills off-screen.
  const toggle = () => {
    if (!open && ref.current) setFlip(ref.current.getBoundingClientRect().left > window.innerWidth / 2);
    setOpen(!open);
  };
  const alignRight = flip || align === 'right';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand/60',
          open
            ? 'border-brand bg-brand/10 text-brand-bright'
            : hasSelection
              ? 'border-brand/50 text-brand-bright hover:bg-brand/5'
              : 'border-border text-muted hover:text-text'
        )}
      >
        {buttonLabel}
        {summary && <span className="text-xs font-normal text-muted-2">{summary}</span>}
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            role="menu"
            className={cn(
              'absolute top-11 z-40 max-h-[22rem] space-y-3 overflow-y-auto rounded-card border border-border bg-bg-elev p-3 shadow-pop',
              panelWidth,
              alignRight ? 'right-0' : 'left-0'
            )}
          >
            {groups.map((g) => (
              <div key={g.label}>
                {!hideGroupHeader && (
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-2">{g.label}</div>
                )}
                <div className="space-y-1.5">
                  {g.items.map((it) => (
                    <label key={it.key} className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-text-soft">
                      <input
                        type="checkbox"
                        checked={isChecked(it.key)}
                        onChange={() => onToggle(it.key)}
                        className="h-3.5 w-3.5 accent-brand"
                      />
                      {it.color && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: it.color }} />}
                      {it.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A row of per-group MultiSelectDropdowns sharing one "only one open at a time"
 * coordinator, so every theme group is visible as its own button while selections
 * accumulate into the caller's single shared set. Each button shows its live
 * in-group selected count and stays outlined while it holds any selection.
 */
export function GroupedDropdownBar({
  groups,
  isChecked,
  onToggle,
  panelWidth = 'w-72',
}: {
  groups: DropdownGroup[];
  isChecked: (key: string) => boolean;
  onToggle: (key: string) => void;
  panelWidth?: string;
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((g) => {
        const count = g.items.reduce((n, it) => n + (isChecked(it.key) ? 1 : 0), 0);
        return (
          <MultiSelectDropdown
            key={g.label}
            buttonLabel={g.label}
            summary={count ? `· ${count}` : undefined}
            hasSelection={count > 0}
            groups={[g]}
            hideGroupHeader
            panelWidth={panelWidth}
            isChecked={isChecked}
            onToggle={onToggle}
            open={openLabel === g.label}
            onOpenChange={(o) => setOpenLabel(o ? g.label : null)}
          />
        );
      })}
    </div>
  );
}
