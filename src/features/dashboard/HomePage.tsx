import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useAuthStore } from '@/features/auth/authStore';
import { NAV_ITEMS } from '@/app/navigation';
import { Sparkline } from '@/components/charts/Sparkline';
import { heatColor } from '@/data/calculations';
import { decodeHtml } from '@/lib/format';

const STATS = [
  { v: '37', l: 'States + FCT' },
  { v: '3', l: 'Programme areas' },
  { v: '69', l: 'Indicators tracked' },
  { v: '7', l: 'Linked dashboards' },
];

export function HomePage() {
  const ds = getDataSource();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { data: kpiGroups } = useAsync(() => ds.getKpiGroups());

  const highlights = useMemo(() => (kpiGroups ? kpiGroups.flatMap((g) => g.cards).slice(0, 4) : []), [kpiGroups]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mb-6 overflow-hidden rounded-card border border-border bg-bg-elev p-6 shadow-card sm:p-8"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ background: 'radial-gradient(70% 120% at 100% 0%, rgb(var(--c-green)), transparent 60%)' }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-bright">
            <Sparkles size={13} /> Welcome back
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
            Good to see you, {firstName}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Your central hub for Primary Health Care performance across Nigeria — organised around three
            questions: is the facility <b className="text-text-soft">ready</b> to deliver care, is it{' '}
            <b className="text-text-soft">stocked</b> to deliver care, and is it actually{' '}
            <b className="text-text-soft">delivering</b> care.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/app/overview"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Open Overview <ArrowRight size={17} />
            </Link>
            <Link
              to="/app/facilities"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold text-text transition-colors hover:bg-bg-elev-2"
            >
              Facility Deepdive
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l} className="rounded-xl border border-border bg-bg-elev-2/60 px-4 py-3">
                <div className="text-2xl font-extrabold text-brand-bright">{s.v}</div>
                <div className="text-[11px] font-medium text-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Key metric highlights */}
      {highlights.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-2">At a glance</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((k) => {
              const color = heatColor(k.inverse ? 100 - k.pct : k.pct);
              return (
                <button
                  key={k.label}
                  onClick={() => navigate('/app/overview')}
                  className="rounded-card border border-border bg-bg-elev p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <div className="text-[11px] font-medium leading-snug text-muted">{decodeHtml(k.label)}</div>
                  <div className="mt-1 text-2xl font-extrabold text-text">{k.value}</div>
                  <div className={`text-xs font-bold ${k.dir === 'up' ? 'text-brand-bright' : 'text-danger'}`}>{k.delta}</div>
                  <div className="mt-2 h-8">
                    <Sparkline data={k.spark} color={color} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section navigation */}
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-2">Dashboard sections</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.map((item, i) => (
          <motion.button
            key={item.to}
            onClick={() => navigate(item.to)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="group flex flex-col rounded-card border border-border bg-bg-elev p-5 text-left shadow-card transition-all hover:-translate-y-1 hover:border-brand/50 hover:shadow-card-hover"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/12 text-brand-bright">
              <item.icon size={22} />
            </div>
            <h3 className="mt-4 text-base font-bold text-text">{item.label}</h3>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{item.description}</p>
            <span className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand-bright">
              Explore <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
