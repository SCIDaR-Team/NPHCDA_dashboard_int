import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Check, Layers, X } from 'lucide-react';
import type { Blocks, BlockName, Indicator } from '@/data/types';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface MapColorSelection {
  /** Empty set → composite performance score. */
  names: Set<string>;
}

interface Props {
  blocks: Blocks;
  selection: MapColorSelection;
  onChange: (next: MapColorSelection) => void;
}

/**
 * Map "colour by" control (matches the original two-level intent):
 * the user first sees the three thematic areas, expands one to reveal its
 * indicators, and can multi-select indicators — across different themes.
 */
export function MapIndicatorPicker({ blocks, selection, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<BlockName | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const eligibleByBlock = useMemo(() => {
    const out: Record<string, Indicator[]> = {};
    (Object.keys(blocks) as BlockName[]).forEach((bn) => {
      out[bn] = blocks[bn].filter((i) => i.pct > 0 && !i.split4 && i.disagg?.includes('state'));
    });
    return out;
  }, [blocks]);

  const count = selection.names.size;
  const label =
    count === 0
      ? 'Composite performance score'
      : count === 1
        ? cleanName([...selection.names][0])
        : `${count} indicators selected`;

  const toggleName = (name: string) => {
    const next = new Set(selection.names);
    next.has(name) ? next.delete(name) : next.add(name);
    onChange({ names: next });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-64 items-center justify-between gap-2 rounded-lg border border-border bg-bg-elev-2 px-3 text-sm font-medium text-text transition-colors hover:bg-bg-elev-3"
      >
        <span className="flex items-center gap-2 truncate">
          <Layers size={15} className="flex-shrink-0 text-brand-bright" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown size={15} className="flex-shrink-0 text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-card border border-border bg-bg-elev shadow-pop"
          >
            <div className="flex items-center justify-between border-b border-border-soft px-3 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-2">Colour the map by</span>
              {count > 0 && (
                <button
                  onClick={() => onChange({ names: new Set() })}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-bright hover:underline"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {/* Composite option */}
              <button
                onClick={() => onChange({ names: new Set() })}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                  count === 0 ? 'bg-brand/12 text-brand-bright' : 'text-text-soft hover:bg-bg-elev-2'
                )}
              >
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', count === 0 ? 'border-brand bg-brand text-white' : 'border-border')}>
                  {count === 0 && <Check size={11} />}
                </span>
                Composite performance score
              </button>

              <div className="my-1.5 h-px bg-border-soft" />

              {(Object.keys(blocks) as BlockName[]).map((bn) => {
                const inds = eligibleByBlock[bn];
                const selectedInBlock = inds.filter((i) => selection.names.has(i.name)).length;
                const isOpen = expanded === bn;
                return (
                  <div key={bn}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : bn)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-text transition-colors hover:bg-bg-elev-2"
                    >
                      <span className="flex items-center gap-1.5">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {bn}
                      </span>
                      {selectedInBlock > 0 && (
                        <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-bright">
                          {selectedInBlock}
                        </span>
                      )}
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          {inds.map((ind) => {
                            const checked = selection.names.has(ind.name);
                            return (
                              <button
                                key={ind.name}
                                onClick={() => toggleName(ind.name)}
                                className="flex w-full items-start gap-2 rounded-lg py-2 pl-8 pr-3 text-left text-xs text-text-soft transition-colors hover:bg-bg-elev-2"
                              >
                                <span className={cn('mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border', checked ? 'border-brand bg-brand text-white' : 'border-border')}>
                                  {checked && <Check size={9} />}
                                </span>
                                <span className="leading-snug">{cleanName(ind.name)}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
