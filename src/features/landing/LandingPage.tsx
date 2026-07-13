import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  HeartPulse,
  Package,
  Stethoscope,
  Map,
  TrendingUp,
  Table2,
  ShieldCheck,
  Filter,
  Download,
  Search,
  Moon,
  BellRing,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui';
import { ThemeToggle } from '@/components/layout/TopbarMenus';
import { useAuthStore } from '@/features/auth/authStore';

const STATS = [
  { v: '37', l: 'States + FCT' },
  { v: '3', l: 'Programme areas' },
  { v: '41', l: 'Indicators tracked' },
  { v: '7', l: 'Linked dashboards' },
];

const PILLARS = [
  {
    icon: HeartPulse,
    title: 'Facility Readiness',
    desc: 'Infrastructure, workforce, financing flows and governance systems that decide whether a facility can deliver care.',
  },
  {
    icon: Package,
    title: 'Stock Status',
    desc: 'Tracer commodities, equipment, cold-chain and vaccine stock-out signals — plus the financing behind them.',
  },
  {
    icon: Stethoscope,
    title: 'Service Delivery',
    desc: 'Uptake of RMNCAH+N services, maternal & child outcomes, community engagement and health-security surveillance.',
  },
];

const FEATURES = [
  { icon: Map, title: 'Interactive state map', desc: 'Choropleth of all 37 states with donor footprint and drill-down profiles.' },
  { icon: Filter, title: 'Scoped filtering', desc: 'Zone → State → LGA → Ward → Facility cascading filters across every page.' },
  { icon: TrendingUp, title: 'Trend analysis', desc: 'Compare indicators monthly, quarterly or yearly with trendline overlays.' },
  { icon: Table2, title: 'Facility deepdive', desc: 'Searchable, exportable State → LGA → Facility performance matrix.' },
  { icon: Search, title: 'Global search', desc: 'Jump to any indicator, state or page instantly with ⌘K.' },
  { icon: Download, title: 'Export anywhere', desc: 'Download views as CSV, Excel, PDF or image for reports and briefings.' },
  { icon: BellRing, title: 'Alerts & insights', desc: 'Surfacing the metrics that need attention, the moment they slip.' },
  { icon: Moon, title: 'Dark & light', desc: 'A polished, responsive experience tuned for desktop and mobile alike.' },
];

export function LandingPage() {
  const user = useAuthStore((s) => s.user);
  // When a session is already active, the public entry point routes straight
  // back into the app — no re-authentication.
  const appDest = '/app/home';

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to={appDest} aria-label="Go to dashboard">
                <Button variant="primary" size="sm">
                  Go to dashboard <ArrowRight size={15} />
                </Button>
              </Link>
            ) : (
              <Link to="/login" aria-label="Sign in">
                <Button variant="primary" size="sm">
                  Sign in <ArrowRight size={15} />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgb(var(--c-green) / 0.7), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Copy */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center lg:text-left"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-bright">
                <ShieldCheck size={14} /> National PHC Decision-Support Platform
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                PHC performance for Nigeria,{' '}
                <span className="bg-gradient-to-r from-brand-bright to-brand-dark bg-clip-text text-transparent">
                  in one executive view
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-soft sm:text-lg lg:mx-0">
                A consolidated, executive view of Primary Health Care across Nigeria, organised around
                three simple questions: is the facility <strong>ready</strong> to deliver care, is it{' '}
                <strong>stocked</strong> to deliver care, and is it actually <strong>delivering</strong> care.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link to={user ? appDest : '/login'}>
                  <Button size="lg" className="w-full sm:w-auto">
                    {user ? 'Open dashboard' : 'Launch dashboard'} <ArrowRight size={18} />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Explore features
                  </Button>
                </a>
              </div>

              {/* Stats */}
              <motion.div
                className="mx-auto mt-12 grid max-w-md grid-cols-2 gap-4 sm:grid-cols-4 lg:mx-0 lg:max-w-none"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                {STATS.map((s) => (
                  <div key={s.l} className="rounded-card border border-border bg-bg-elev p-4 shadow-card">
                    <div className="text-2xl font-extrabold text-brand-bright">{s.v}</div>
                    <div className="mt-1 text-xs font-medium text-muted">{s.l}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Hero visual — framed as an app window so the product screenshot
                reads as intentional and blends into the surrounding surface. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative mx-auto w-full max-w-md lg:max-w-none"
            >
              {/* Soft brand glow behind the frame */}
              <div
                className="pointer-events-none absolute -inset-6 -z-10 opacity-40 blur-2xl"
                style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgb(var(--c-green) / 0.5), transparent 70%)' }}
              />
              <div className="overflow-hidden rounded-2xl border border-border bg-bg-elev shadow-2xl ring-1 ring-black/5">
                {/* Window chrome */}
                <div className="flex items-center gap-1.5 border-b border-border-soft bg-bg-elev-2 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 hidden text-[12px] font-medium text-muted sm:inline">
                    NPHCDA Dashboard — Overview
                  </span>
                </div>
                <img
                  src="/images/hero_facility.png"
                  alt="The NPHCDA dashboard showing PHC performance across Nigeria"
                  className="block w-full"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pillars — tinted band gives a clear colour break from the hero above */}
      <section className="border-y border-border bg-brand/[0.05]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionLabel>The three building blocks</SectionLabel>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-card border border-border bg-bg-elev p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/12 text-brand-bright">
                  <p.icon size={24} />
                </div>
                <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 border-y border-border bg-bg-elev/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionLabel>Built for decision-makers</SectionLabel>
          <h2 className="mt-3 max-w-2xl text-2xl font-extrabold sm:text-3xl">
            Everything you need to monitor, compare and act
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: (i % 4) * 0.06 }}
                className="rounded-card border border-border bg-bg-elev p-5 shadow-card"
              >
                <f.icon size={20} className="text-brand-bright" />
                <h3 className="mt-3 text-sm font-bold">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Ready to dive in?</h2>
        <p className="mx-auto mt-3 max-w-xl text-text-soft">
          {user
            ? 'Your session is active — jump straight back into the workspace: every page, filter and export.'
            : 'Sign in with the demo account to explore the full platform — every page, filter and export.'}
        </p>
        <Link to={user ? appDest : '/login'} className="mt-8 inline-block">
          <Button size="lg">
            {user ? 'Open dashboard' : 'Sign in to continue'} <ArrowRight size={18} />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-muted sm:flex-row">
          <Logo />
          <p>Live PHC performance data for decision-support. © {new Date().getFullYear()} NPHCDA.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-bold uppercase tracking-[0.15em] text-brand-bright">{children}</span>
  );
}
