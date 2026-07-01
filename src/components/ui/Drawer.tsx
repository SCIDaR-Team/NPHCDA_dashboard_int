import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  side?: 'left' | 'right';
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  side = 'left',
  width = 360,
  children,
  footer,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const x = side === 'left' ? -width : width;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed bottom-0 top-0 z-[95] flex flex-col border-border bg-bg-elev shadow-pop"
            style={{ width, [side]: 0, borderRightWidth: side === 'left' ? 1 : 0, borderLeftWidth: side === 'right' ? 1 : 0 }}
            initial={{ x }}
            animate={{ x: 0 }}
            exit={{ x }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {(title || subtitle) && (
              <div className="flex items-start justify-between gap-3 border-b border-border-soft px-5 py-4">
                <div>
                  {title && <h3 className="text-base font-bold text-text">{title}</h3>}
                  {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg-elev-2 hover:text-text"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-border-soft px-5 py-3">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
