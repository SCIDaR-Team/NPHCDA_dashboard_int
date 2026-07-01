import { useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Allow rich/wider tooltips (e.g. definitions). */
  wide?: boolean;
}

/** Lightweight hover/focus tooltip rendered in a portal so it never gets clipped. */
export function Tooltip({ content, children, wide }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setOpen(true);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        className="inline-flex cursor-help outline-none"
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-full"
              style={{ left: pos.x, top: pos.y - 8, maxWidth: wide ? 320 : 240 }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              <div className="rounded-lg border border-border bg-bg-elev-3 px-3 py-2 text-xs leading-relaxed text-text-soft shadow-pop">
                {content}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
