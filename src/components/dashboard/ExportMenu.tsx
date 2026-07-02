import { useRef, useState, useEffect, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileText, FileSpreadsheet, Image, FileType } from 'lucide-react';
import { exportCSV, exportExcel, exportElementToPNG, exportElementToPDF } from '@/lib/export';
import { useNotificationStore } from '@/store/notificationStore';

interface ExportMenuProps {
  filename: string;
  /** Tabular data for CSV/Excel. */
  rows?: Record<string, unknown>[];
  /** Element to rasterise for PNG/PDF. */
  captureRef?: RefObject<HTMLElement>;
}

export function ExportMenu({ filename, rows, captureRef }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useNotificationStore((s) => s.toast);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const run = async (fn: () => void | Promise<void>, label: string) => {
    setOpen(false);
    try {
      await fn();
      toast({ tone: 'success', title: `Exported ${label}` });
    } catch (e) {
      toast({ tone: 'error', title: 'Export failed', description: (e as Error).message });
    }
  };

  const items = [
    rows && {
      icon: FileText,
      label: 'CSV',
      action: () => run(() => exportCSV(filename, rows), 'CSV'),
    },
    rows && {
      icon: FileSpreadsheet,
      label: 'Excel (.xlsx)',
      action: () => run(() => exportExcel(filename, rows), 'Excel'),
    },
    captureRef && {
      icon: Image,
      label: 'Image (PNG)',
      action: () =>
        run(async () => {
          if (captureRef.current) await exportElementToPNG(captureRef.current, filename);
        }, 'image'),
    },
    captureRef && {
      icon: FileType,
      label: 'PDF',
      action: () =>
        run(async () => {
          if (captureRef.current) await exportElementToPDF(captureRef.current, filename);
        }, 'PDF'),
    },
  ].filter(Boolean) as { icon: typeof FileText; label: string; action: () => void }[];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export this view"
        className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-soft transition-colors hover:bg-bg-elev-2 hover:text-text"
      >
        <Download size={15} /> Export
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-card border border-border bg-bg-elev p-1.5 shadow-pop"
          >
            {items.map((it) => (
              <button
                key={it.label}
                onClick={it.action}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-soft transition-colors hover:bg-bg-elev-2 hover:text-text"
              >
                <it.icon size={15} /> {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
