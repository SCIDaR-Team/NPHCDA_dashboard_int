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
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui';
import { ThemeToggle } from '@/components/layout/TopbarMenus';

const STATS = [
  { v: '37', l: 'States + FCT' },
  { v: '3', l: 'Programme areas' },
  { v: '69', l: 'Indicators tracked' },
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
  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="primary" size="sm">
                Sign in <ArrowRight size={15} />
              </Button>
            </Link>
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
        <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-bright">
              <ShieldCheck size={14} /> National PHC Decision-Support Platform
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              PHC performance for Nigeria,{' '}
              <span className="bg-gradient-to-r from-brand-bright to-brand-dark bg-clip-text text-transparent">
                in one executive view
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-text-soft sm:text-lg">
              A consolidated, executive view of Primary Health Care across Nigeria, organised around
              three simple questions: is the facility <strong>ready</strong> to deliver care, is it{' '}
              <strong>stocked</strong> to deliver care, and is it actually <strong>delivering</strong> care.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Launch dashboard <ArrowRight size={18} />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Explore features
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {STATS.map((s) => (
              <div key={s.l} className="rounded-card border border-border bg-bg-elev p-5 shadow-card">
                <div className="text-3xl font-extrabold text-brand-bright">{s.v}</div>
                <div className="mt-1 text-xs font-medium text-muted">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Dashboard preview mockup (pure CSS, no images) */}
      <section className="mx-auto -mt-2 max-w-5xl px-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-card border border-border bg-bg-elev p-5 shadow-card-hover"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ background: 'radial-gradient(50% 60% at 50% 0%, rgb(var(--c-green)), transparent 70%)' }}
          />
          {/* window chrome */}
          <div className="relative mb-4 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
          </div>
          <div className="relative grid gap-4 sm:grid-cols-3">
            {[
              ['Penta 3 Coverage', '86.4%', 86],
              ['Wards w/ Functional PHC', '68.2%', 68],
              ['Patient Satisfaction', '76.9%', 77],
            ].map(([label, val, pct]) => (
              <div key={label as string} className="rounded-xl border border-border bg-bg-elev-2/60 p-4">
                <div className="text-[11px] text-muted">{label}</div>
                <div className="mt-1 text-2xl font-extrabold text-text">{val}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elev-3">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          {/* faux bar chart */}
          <div className="relative mt-4 rounded-xl border border-border bg-bg-elev-2/60 p-4">
            <div className="mb-3 text-[11px] font-semibold text-muted">Programme performance by state</div>
            <div className="flex h-24 items-end gap-1.5">
              {[62, 48, 71, 55, 83, 40, 67, 74, 58, 70, 45, 79, 64, 52, 68, 60].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(180deg, rgb(var(--c-green-bright)), rgb(var(--c-green-dark)))`,
                    opacity: 0.55 + (h / 100) * 0.45,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* About NPHCDA (icon + gradient, no photos) */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div
            className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-card border border-border p-8 shadow-card"
            style={{ background: 'linear-gradient(135deg, #007A45 0%, #00A859 55%, #10C46E 100%)' }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.45) 0, transparent 35%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.3) 0, transparent 30%)',
              }}
            />
            <LogoMark size={48} className="relative shadow-lg" />
            <div className="relative grid grid-cols-2 gap-4 text-white">
              {[
                ['37', 'States + FCT'],
                ['774', 'LGAs covered'],
                ['69', 'Indicators'],
                ['3', 'Programme areas'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="text-2xl font-extrabold">{v}</div>
                  <div className="text-xs text-white/80">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>About the agency</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">
              National Primary Health Care Development Agency
            </h2>
            <p className="mt-4 leading-relaxed text-text-soft">
              The NPHCDA leads the delivery of Primary Health Care across Nigeria — strengthening
              facilities, securing essential commodities and expanding life-saving services for mothers
              and children in every state.
            </p>
            <p className="mt-3 leading-relaxed text-muted">
              This platform brings the agency's readiness, stock and service indicators into a single,
              decision-ready workspace — built to scale from today's illustrative figures to live
              national data.
            </p>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-5 py-16">
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
      </section>

      {/* Features */}
      <section id="features" className="border-y border-border bg-bg-elev/40">
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
          Sign in with the demo account to explore the full platform — every page, filter and export.
        </p>
        <Link to="/login" className="mt-8 inline-block">
          <Button size="lg">
            Sign in to continue <ArrowRight size={18} />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-muted sm:flex-row">
          <Logo compact />
          <p>Illustrative figures for design & decision-support. © {new Date().getFullYear()} NPHCDA.</p>
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
