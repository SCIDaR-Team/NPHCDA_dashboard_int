import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Check, Layers, X } from 'lucide-react';
import type { Blocks, BlockName, Indicator } from '@/data/types';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/cn';

const MENU_WIDTH = 320; // px (matches the w-80 the menu used to be)

export interface MapColorSelection {
  /** null → composite performance score; otherwise the single indicator to colour by. */
  name: string | null;
}

interface Props {
  blocks: Blocks;
  selection: MapColorSelection;
  onChange: (next: MapColorSelection) => void;
}

/**
 * Map "colour by" control (single-select, like the reference dashboard):
 * the user first sees the thematic areas, expands one to reveal its indicators,
 * and picks ONE indicator (or Composite). Colouring by a single indicator keeps
 * every coloured state directly comparable and lets out-of-coverage states grey out.
 */
export function MapIndicatorPicker({ blocks, selection, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<BlockName | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Anchor rect for the portalled menu — the menu renders into <body> (so the map
  // card's `overflow-hidden` can't clip long blocks) and is positioned against this.
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keep the menu anchored to the button while open (reposition on scroll/resize).
  useEffect(() => {
    if (!open) return;
    const update = () => btnRef.current && setRect(btnRef.current.getBoundingClientRect());
    update();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const eligibleByBlock = useMemo(() => {
    const out: Record<string, Indicator[]> = {};
    (Object.keys(blocks) as BlockName[]).forEach((bn) => {
      out[bn] = blocks[bn].filter((i) => i.pct > 0 && !i.split4 && i.disagg?.includes('state'));
    });
    return out;
  }, [blocks]);

  const isComposite = selection.name === null;
  const label = isComposite ? 'Composite performance score' : cleanName(selection.name!);

  const selectName = (name: string) => {
    onChange({ name });
    setOpen(false);
  };
  const selectComposite = () => {
    onChange({ name: null });
    setOpen(false);
  };

  // Right-align the menu to the button, clamped into the viewport; cap its height to
  // the space below so it always scrolls rather than running off-screen.
  const menuLeft = rect ? Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)) : 0;
  const menuTop = rect ? rect.bottom + 8 : 0;
  const menuMaxH = rect ? Math.max(220, window.innerHeight - rect.bottom - 24) : 480;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Colour the map by — currently ${label}`}
        className="flex h-9 w-64 items-center justify-between gap-2 rounded-lg border border-border bg-bg-elev-2 px-3 text-sm font-medium text-text transition-colors hover:bg-bg-elev-3 focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <span className="flex items-center gap-2 truncate">
          <Layers size={15} className="flex-shrink-0 text-brand-bright" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown size={15} className="flex-shrink-0 text-muted" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              style={{ position: 'fixed', top: menuTop, left: menuLeft, width: MENU_WIDTH, maxHeight: menuMaxH }}
              className="z-[200] flex flex-col overflow-hidden rounded-card border border-border bg-bg-elev shadow-pop"
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-border-soft px-3 py-2.5">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-2">Colour the map by</span>
                {!isComposite && (
                  <button
                    onClick={selectComposite}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-bright hover:underline"
                  >
                    <X size={12} /> Reset
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {/* Composite option */}
              <button
                onClick={selectComposite}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                  isComposite ? 'bg-brand/12 text-brand-bright' : 'text-text-soft hover:bg-bg-elev-2'
                )}
              >
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', isComposite ? 'border-brand bg-brand text-white' : 'border-border')}>
                  {isComposite && <Check size={11} />}
                </span>
                Composite performance score
              </button>

              <div className="my-1.5 h-px bg-border-soft" />

              {(Object.keys(blocks) as BlockName[]).map((bn) => {
                const inds = eligibleByBlock[bn];
                const selectedInBlock = inds.some((i) => i.name === selection.name);
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
                      {selectedInBlock && (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-bright" aria-hidden />
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
                            const checked = selection.name === ind.name;
                            return (
                              <button
                                key={ind.name}
                                onClick={() => selectName(ind.name)}
                                className={cn(
                                  'flex w-full items-start gap-2 rounded-lg py-2 pl-8 pr-3 text-left text-xs transition-colors hover:bg-bg-elev-2',
                                  checked ? 'text-brand-bright' : 'text-text-soft'
                                )}
                              >
                                <span className={cn('mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border', checked ? 'border-brand bg-brand text-white' : 'border-border')}>
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
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
