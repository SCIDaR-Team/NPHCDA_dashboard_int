import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useNotificationStore, type ToastTone } from '@/store/notificationStore';

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ACCENT: Record<ToastTone, string> = {
  success: 'text-brand-bright',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

export function Toaster() {
  const { toasts, dismiss } = useNotificationStore();

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[300] flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-bg-elev p-3.5 shadow-pop"
            >
              <Icon size={18} className={ACCENT[t.tone]} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-muted transition-colors hover:text-text"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body
  );
}
