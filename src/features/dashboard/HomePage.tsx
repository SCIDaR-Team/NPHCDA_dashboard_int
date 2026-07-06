import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { NAV_ITEMS } from '@/app/navigation';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/layout/TopbarMenus';

/** Platform scope at a glance — the headline numbers that frame the dashboard. */
const STATS = [
  { v: '37', l: 'States + FCT' },
  { v: '3', l: 'Programme areas' },
  { v: '41', l: 'Indicators tracked' },
  { v: '7', l: 'Linked dashboards' },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* Standalone header — Home is the entry point, outside the dashboard shell. */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/app/overview"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              Open dashboard <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-card border border-border bg-brand/[0.18] p-5 shadow-card dark:bg-brand/[0.14] sm:p-6"
      >
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-bright">
            <ShieldCheck size={13} /> National PHC decision-support platform
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-[1.15] tracking-tight text-text sm:text-3xl">
            PHC performance for Nigeria,{' '}
            <span className="bg-gradient-to-r from-brand-bright to-brand-dark bg-clip-text text-transparent">
              in one executive view
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-soft">
            Your central hub for Primary Health Care across Nigeria, organised around three questions: is the
            facility <b className="text-text">ready</b> to deliver care, is it <b className="text-text">stocked</b>{' '}
            to deliver care, and is it actually <b className="text-text">delivering</b> care.
          </p>
        </div>

        {/* Stats */}
        <motion.dl
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {STATS.map((s) => (
            <div
              key={s.l}
              className="rounded-xl border border-border bg-bg-elev p-4 shadow-card"
            >
              <dd className="text-2xl font-extrabold text-brand-bright sm:text-3xl">{s.v}</dd>
              <dt className="mt-1 text-xs font-medium text-muted">{s.l}</dt>
            </div>
          ))}
        </motion.dl>
      </motion.section>

      {/* Section navigation — tinted panel matching the landing page's pillars band. */}
      <section className="rounded-card border border-border bg-brand/[0.09] p-5 sm:p-6 dark:bg-brand/[0.07]">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={16} className="text-brand-bright" />
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-brand-bright">Explore the dashboard</h2>
        </div>
        <p className="mt-1.5 text-sm text-muted">Jump straight into any section of the platform.</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {NAV_ITEMS.map((item, i) => (
            <motion.button
              key={item.to}
              onClick={() => navigate(item.to)}
              aria-label={`${item.label} — ${item.description}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="group flex flex-col rounded-card border border-border bg-bg-elev p-5 text-left shadow-card transition-all hover:-translate-y-1 hover:border-brand/50 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-bright transition-colors group-hover:bg-brand/20">
                <item.icon size={21} />
              </div>
              <h3 className="mt-4 text-base font-bold text-text">{item.label}</h3>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{item.description}</p>
              <span className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand-bright">
                Explore <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </span>
            </motion.button>
          ))}
        </div>
      </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <p className="text-center font-semibold text-text-soft">Powered by SCIDaR</p>
          <p className="text-center sm:text-right">
            Live PHC performance data for decision-support. © {new Date().getFullYear()} NPHCDA.
          </p>
        </div>
      </footer>
    </div>
  );
}
