import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, CornerDownLeft, MapPin, BarChart3, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { blocks } from '@/data/mock/indicators';
import { ALL_STATES } from '@/data/geo/states';
import { NAV_ITEMS, BLOCK_ROUTES } from '@/app/navigation';
import { useFilterStore } from '@/store/filterStore';
import { cleanName } from '@/lib/format';
import type { BlockName } from '@/data/types';

interface Result {
  kind: 'page' | 'indicator' | 'state';
  label: string;
  sub?: string;
  action: () => void;
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const setFilter = useFilterStore((s) => s.set);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const out: Result[] = [];

    NAV_ITEMS.forEach((n) => {
      if (!term || n.label.toLowerCase().includes(term))
        out.push({
          kind: 'page',
          label: n.label,
          sub: 'Page',
          action: () => navigate(n.to),
        });
    });

    if (term) {
      (Object.keys(blocks) as BlockName[]).forEach((bn) => {
        blocks[bn].forEach((ind) => {
          if (cleanName(ind.name).toLowerCase().includes(term)) {
            out.push({
              kind: 'indicator',
              label: cleanName(ind.name),
              sub: bn,
              action: () => navigate(BLOCK_ROUTES[bn]),
            });
          }
        });
      });

      ALL_STATES.forEach((st) => {
        if (st.toLowerCase().includes(term)) {
          out.push({
            kind: 'state',
            label: st,
            sub: 'Scope dashboard to this state',
            action: () => {
              setFilter({ state: st });
              navigate('/app/overview');
            },
          });
        }
      });
    }

    return out.slice(0, 24);
  }, [q, navigate, setFilter]);

  useEffect(() => setActive(0), [q]);

  const choose = (r?: Result) => {
    const target = r ?? results[active];
    if (target) {
      target.action();
      onClose();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const icons = { page: FileText, indicator: BarChart3, state: MapPin };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-card border border-border bg-bg-elev shadow-pop"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="flex items-center gap-3 border-b border-border-soft px-4">
              <Search size={18} className="text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search indicators, states, pages…"
                className="h-14 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">No matches found.</p>
              ) : (
                results.map((r, i) => {
                  const Icon = icons[r.kind];
                  return (
                    <button
                      key={r.kind + r.label + i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(r)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        i === active ? 'bg-brand/12' : 'hover:bg-bg-elev-2'
                      }`}
                    >
                      <Icon size={16} className="flex-shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text">{r.label}</div>
                        {r.sub && <div className="truncate text-xs text-muted">{r.sub}</div>}
                      </div>
                      {i === active && <CornerDownLeft size={14} className="text-muted" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
