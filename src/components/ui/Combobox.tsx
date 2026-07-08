import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ComboOption {
  value: string;
  label: string;
}

/**
 * A searchable single-select that expands DOWNWARD, in normal flow, so its list
 * always renders inside its container (e.g. the filter drawer) rather than as a
 * native OS popup that the browser may flip upward. In-flow (not absolute) is
 * deliberate: the drawer body is `overflow-y-auto`, which would clip an absolutely
 * positioned panel — expanding in-flow grows the scroll height so every option
 * stays reachable. The built-in search keeps long lists (hundreds of facilities)
 * usable.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus the search box when the panel opens; reset the query when it closes.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-elev-2 px-3 text-left text-sm text-text transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30',
          open && 'border-brand ring-2 ring-brand/30'
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-2')}>{label}</span>
        <ChevronDown size={16} className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-border bg-bg-elev-2 shadow-pop">
          <div className="relative border-b border-border-soft p-2">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-border bg-bg-elev pl-8 pr-2 text-sm text-text placeholder:text-muted-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted">No matches</li>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-elev-3',
                        active ? 'font-semibold text-brand-bright' : 'text-text-soft'
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {active && <Check size={14} className="shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
