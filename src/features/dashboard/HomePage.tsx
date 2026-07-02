import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { NAV_ITEMS } from '@/app/navigation';

const STATS = [
  { v: '37', l: 'States + FCT' },
  { v: '3', l: 'Programme areas' },
  { v: '69', l: 'Indicators tracked' },
  { v: '7', l: 'Linked dashboards' },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col gap-4">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative flex-shrink-0 overflow-hidden rounded-card border border-border bg-bg-elev p-5 shadow-card sm:p-6"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ background: 'radial-gradient(70% 140% at 100% 0%, rgb(var(--c-green)), transparent 60%)' }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-bright">
              <LayoutDashboard size={13} /> Dashboard home
            </span>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">
              Your central hub for Primary Health Care performance across Nigeria — organised around three
              questions: is the facility <b className="text-text-soft">ready</b> to deliver care, is it{' '}
              <b className="text-text-soft">stocked</b> to deliver care, and is it actually{' '}
              <b className="text-text-soft">delivering</b> care.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/app/overview"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Open Overview <ArrowRight size={16} />
              </Link>
              <Link
                to="/app/facilities"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-bg-elev-2"
              >
                Facility Deepdive
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex-shrink-0">
            {STATS.map((s) => (
              <div key={s.l} className="rounded-xl border border-border bg-bg-elev-2/60 px-4 py-3">
                <div className="text-2xl font-extrabold text-brand-bright">{s.v}</div>
                <div className="text-[11px] font-medium text-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Section navigation */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:grid-rows-2">
        {NAV_ITEMS.map((item, i) => (
          <motion.button
            key={item.to}
            onClick={() => navigate(item.to)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className="group flex h-full flex-col rounded-card border border-border bg-bg-elev p-4 text-left shadow-card transition-all hover:-translate-y-1 hover:border-brand/50 hover:shadow-card-hover sm:p-5"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-bright">
              <item.icon size={20} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-text sm:text-base">{item.label}</h3>
            <p className="mt-1.5 hidden flex-1 text-xs leading-relaxed text-muted sm:block">
              {item.description}
            </p>
            <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-bold uppercase tracking-wide text-brand-bright">
              Explore <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
