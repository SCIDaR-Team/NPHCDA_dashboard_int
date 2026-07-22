import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { SIDEBAR_NAV, isNavGroup, type NavGroup, type NavItem } from '@/app/navigation';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/layout/TopbarMenus';
import { ALL_STATES, STATE_PATHS, STATE_CENTROIDS, MAP_VBW, MAP_VBH } from '@/data/geo/states';
import { cn } from '@/lib/cn';

/**
 * The platform entry point.
 *
 *   1. An interactive product explorer: a CSS mockup of the app whose rail really
 *      drives its canvas, so a visitor previews every section without leaving the
 *      page — and can open the one they want. This IS the navigation; there is no
 *      separate grid of section cards.
 *   2. The three questions the platform is built around.
 *
 * Every preview is a WIREFRAME — deliberate blocks and bars, never figures. A
 * landing page must not present numbers that could be mistaken for a measurement
 * or drift out of date against the live dashboard, so this page fetches no data.
 *
 * The rail is generated from SIDEBAR_NAV, so it cannot drift from the real
 * sidebar: "Other Analysis" stays ONE expandable group and, because the flat
 * items are rendered before the groups, it lands immediately after Source
 * Dashboards structurally rather than by a hand-maintained list.
 */

/* ================================================================== *
 * Wireframe primitives — the vocabulary every section preview is built
 * from. Shapes only: no text that could read as a measurement.
 * ================================================================== */

const bar = 'rounded-[2px] bg-brand/25';
const chip = 'rounded bg-bg-elev-3';

/** Nodes sit on real state centroids so the constellation reads as Nigeria. */
const NODE_STATES = ['Sokoto', 'Borno', 'Kano', 'Lagos', 'Rivers', 'Benue', 'Adamawa', 'Oyo', 'Enugu', 'Kebbi'];

/** The map draws itself in once per page load. The rail switches on hover, so
 *  without this the full ~2s draw would replay every time the pointer passed
 *  back over Overview. */
let mapHasDrawn = false;

/** The national map. Drawn as an outline, never a choropleth — a heat fill would
 *  imply per-state scores, and this page carries no measurements. */
function WireMap() {
  const reduced = useReducedMotion();
  const [draw] = useState(() => !mapHasDrawn && !reduced);
  useEffect(() => {
    mapHasDrawn = true;
  }, []);
  const nodes = useMemo(
    () => NODE_STATES.map((s) => STATE_CENTROIDS[s]).filter(Boolean).map(([x, y], i) => ({ x, y, i })),
    []
  );
  return (
    <svg
      viewBox={`0 0 ${MAP_VBW} ${MAP_VBH}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Outline map of Nigeria showing the states the platform covers"
    >
      <g fill="rgb(var(--c-green) / 0.16)" stroke="rgb(var(--c-green) / 0.65)" strokeWidth={1.2} strokeLinejoin="round">
        {ALL_STATES.map((st, i) => {
          const d = STATE_PATHS[st];
          if (!d) return null;
          return (
            <motion.path
              key={st}
              d={d}
              initial={draw ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { duration: 1.1, delay: 0.25 + i * 0.018, ease: 'easeInOut' },
                opacity: { duration: 0.35, delay: 0.25 + i * 0.018 },
              }}
            />
          );
        })}
      </g>
      {nodes.map(({ x, y, i }) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={3.6}
          fill="rgb(var(--c-green-bright))"
          initial={draw ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.2 + i * 0.05 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </svg>
  );
}

/* --- Card visuals -------------------------------------------------- *
 * Each one FILLS its card. A hollow centre is the strongest "loading
 * skeleton" cue there is, and a mockup that reads as a skeleton defeats
 * the point of showing the product at all.
 * ------------------------------------------------------------------- */

/** The app's real performance scale, so the mockup reads as a performance
 *  tool rather than a monochrome placeholder. */
const HEAT_HIGH = 'rgb(var(--c-heat-high))';
const HEAT_MID = 'rgb(var(--c-heat-mid))';
const HEAT_LOW = 'rgb(var(--c-heat-low))';

function VizRing({ pct, color }: { pct: number; color: string }) {
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full">
      <circle cx="20" cy="20" r={R} fill="none" stroke="rgb(var(--c-bg-elev-3))" strokeWidth="6" />
      <circle
        cx="20"
        cy="20"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${C * pct} ${C}`}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

function VizCols({ heights, colors }: { heights: number[]; colors: string[] }) {
  return (
    <div className="flex h-full items-end gap-[3px]">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-full rounded-[2px]"
          style={{ height: `${h}%`, background: colors[i % colors.length] }}
        />
      ))}
    </div>
  );
}

function VizSpark({ color }: { color: string }) {
  const pts = [14, 9, 12, 6, 8, 4, 5, 2];
  const d = pts.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * 40},${y}`).join(' ');
  return (
    <svg viewBox="0 0 40 16" preserveAspectRatio="none" className="h-full w-full">
      <path d={`${d} L40,16 L0,16 Z`} fill={color} opacity="0.16" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Indicator cards — the block pages. Deliberately mixed: the real block
 *  pages interleave donuts, gauges and trend charts, so a grid of six
 *  identical tiles would read as placeholder. */
const CARD_VIZ = [
  <VizRing pct={0.72} color={HEAT_HIGH} />,
  <VizCols heights={[55, 80, 45, 92, 65]} colors={[`${HEAT_HIGH}`]} />,
  <VizSpark color={HEAT_HIGH} />,
  <VizRing pct={0.41} color={HEAT_MID} />,
  <VizCols heights={[70, 38, 84, 52, 60]} colors={[HEAT_HIGH, HEAT_HIGH, HEAT_LOW, HEAT_HIGH, HEAT_MID]} />,
  <VizSpark color={HEAT_MID} />,
];

function WireCards() {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-3 gap-2.5 sm:grid-cols-3 sm:grid-rows-2">
      {CARD_VIZ.map((viz, i) => (
        <div
          key={i}
          className="flex min-h-0 flex-col gap-2 rounded-lg border border-border-soft bg-bg-elev-2/60 p-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className={cn(chip, 'h-1.5 w-1/2')} />
            <div className={cn(bar, 'h-1.5 w-1.5 rounded-full')} />
          </div>
          <div className="min-h-0 flex-1">{viz}</div>
        </div>
      ))}
    </div>
  );
}

/** Column series — trends and equity. */
function WireBars({ grouped = false }: { grouped?: boolean }) {
  const cols = grouped ? 6 : 9;
  const heights = [52, 78, 44, 90, 62, 84, 38, 70, 58];
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-end gap-2 border-b border-l border-border-soft p-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex h-full w-full items-end gap-[3px]">
            <div className={cn(bar, 'w-full')} style={{ height: `${heights[i % heights.length]}%` }} />
            {grouped && (
              <div
                className="w-full rounded-[2px] bg-brand/50"
                style={{ height: `${(heights[(i + 3) % heights.length] || 50) * 0.8}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between px-2 pt-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={cn(chip, 'h-1.5 w-5')} />
        ))}
      </div>
    </div>
  );
}

/** Data table — facility deepdive and league tables. */
function WireTable({ ranked = false }: { ranked?: boolean }) {
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex gap-2 border-b border-border-soft pb-2">
        {[3, 2, 2, 1].map((w, i) => (
          <div key={i} className={cn(chip, 'h-1.5')} style={{ flex: w }} />
        ))}
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          {ranked && (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-brand/20">
              <div className={cn(bar, 'h-1 w-1.5')} />
            </div>
          )}
          <div className={cn(chip, 'h-2')} style={{ flex: 3 }} />
          <div className={cn(chip, 'h-2 opacity-70')} style={{ flex: 2 }} />
          <div className={cn(chip, 'h-2 opacity-70')} style={{ flex: 2 }} />
          <div className={cn(bar, 'h-2')} style={{ flex: 1 }} />
        </div>
      ))}
    </div>
  );
}

/** Linked dashboard tiles — source dashboards. */
function WireTiles() {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-3 gap-2.5 sm:grid-cols-3 sm:grid-rows-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-0 flex-col gap-2 rounded-lg border border-border-soft bg-bg-elev-2/60 p-2.5"
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 flex-shrink-0 rounded bg-brand/25" />
            <div className={cn(chip, 'h-1.5 flex-1')} />
          </div>
          <div className={cn(chip, 'h-1.5 w-3/5 opacity-60')} />
          <div className="min-h-0 flex-1">
            <VizSpark color={i % 3 === 1 ? HEAT_MID : HEAT_HIGH} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Traffic-light matrix — scorecard and compare scopes. */
function WireMatrix({ cols = 6 }: { cols?: number }) {
  const shades = ['bg-brand/60', 'bg-brand/30', 'bg-warning/40', 'bg-brand/45', 'bg-danger/30', 'bg-brand/25'];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex gap-2 pl-[22%]">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={cn(chip, 'h-1.5 flex-1')} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, r) => (
        <div key={r} className="flex flex-1 items-center gap-2">
          <div className={cn(chip, 'h-2 w-[20%] flex-shrink-0')} />
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={cn('h-full flex-1 rounded', shades[(r + c) % shades.length])} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Completeness checklist — data quality. */
function WireChecklist() {
  return (
    <div className="flex h-full flex-col gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className={cn('h-3.5 w-3.5 flex-shrink-0 rounded-full', i % 3 === 2 ? 'bg-warning/50' : 'bg-brand/45')} />
          <div className={cn(chip, 'h-2 w-1/3')} />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elev-3">
            <div className="h-full rounded-full bg-brand/45" style={{ width: `${95 - i * 11}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Each route's canvas. Keyed by `to` so it stays tied to SIDEBAR_NAV. */
const PREVIEW: Record<string, () => JSX.Element> = {
  '/app/overview': WireMap,
  '/app/readiness': WireCards,
  '/app/stock': WireCards,
  '/app/service': WireCards,
  '/app/trends': () => <WireBars />,
  '/app/facilities': () => <WireTable />,
  '/app/sources': WireTiles,
  '/app/scorecard': () => <WireMatrix />,
  '/app/league': () => <WireTable ranked />,
  '/app/data-quality': WireChecklist,
  '/app/equity': () => <WireBars grouped />,
  '/app/compare': () => <WireMatrix cols={4} />,
};

/* ================================================================== *
 * The explorer — a working mockup that is also the navigation.
 * ================================================================== */

function RailRow({
  entry,
  active,
  onSelect,
}: {
  entry: NavItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onSelect}
      title={entry.description}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
        active ? 'bg-brand/12 text-brand-bright' : 'text-text-soft hover:bg-brand/10 hover:text-brand-bright'
      )}
    >
      <entry.icon size={15} className="flex-shrink-0" />
      <span className="flex-1 truncate">{entry.label}</span>
    </button>
  );
}

function RailGroup({
  group,
  activeTo,
  onSelect,
}: {
  group: NavGroup;
  activeTo: string;
  onSelect: (to: string) => void;
}) {
  const holdsActive = group.items.some((i) => i.to === activeTo);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={group.description}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
          holdsActive && !open ? 'bg-brand/12 text-brand-bright' : 'text-text-soft hover:bg-brand/10 hover:text-brand-bright'
        )}
      >
        <group.icon size={15} className="flex-shrink-0" />
        <span className="flex-1 truncate">{group.label}</span>
        <ChevronDown
          size={13}
          className={cn('flex-shrink-0 text-muted-2 transition-transform duration-300', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-[19px] mt-1 space-y-[3px] border-l border-border-soft pl-2">
              {group.items.map((sub) => (
                <RailRow key={sub.to} entry={sub} active={activeTo === sub.to} onSelect={() => onSelect(sub.to)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Explorer() {
  const [activeTo, setActiveTo] = useState('/app/overview');
  const flat = useMemo(() => {
    const out: NavItem[] = [];
    SIDEBAR_NAV.forEach((e) => (isNavGroup(e) ? out.push(...e.items) : out.push(e)));
    return out;
  }, []);
  const active = flat.find((i) => i.to === activeTo) ?? flat[0];
  const Canvas = PREVIEW[activeTo] ?? WireMap;

  return (
    <div className="relative">
      {/* Deliberately NOT a floating card: no drop shadow, ring or glow, so the
          window sits IN the page rather than hovering above it. A single hairline
          border is all that frames it — enough to still read as the product. */}
      {/* No card, no window chrome: the rail and canvas sit directly on the page,
          so the explorer blends into the surface instead of floating in a box —
          and the green page wash now shows THROUGH it rather than being hidden
          under a white card. Internal dividers (the rail edge, the toolbar and
          footer rules) are all the structure it needs. */}
      <div className="flex flex-col sm:flex-row">
        {/* Rail — the real sidebar, and the page's navigation. */}
        <div className="flex-shrink-0 border-b border-border sm:w-[228px] sm:border-b-0 sm:border-r">
          <div className="flex h-11 items-center gap-2 border-b border-border px-3">
            <LogoMark size={20} />
            <span className="truncate text-[11px] font-extrabold tracking-tight text-text">NPHCDA Dashboard</span>
          </div>
            <div className="space-y-[3px] p-2.5">
              <p className="px-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-2">Dashboard</p>
              {SIDEBAR_NAV.map((entry) =>
                isNavGroup(entry) ? (
                  <RailGroup key={entry.label} group={entry} activeTo={activeTo} onSelect={setActiveTo} />
                ) : (
                  <RailRow
                    key={entry.to}
                    entry={entry}
                    active={activeTo === entry.to}
                    onSelect={() => setActiveTo(entry.to)}
                  />
                )
              )}
            </div>
          </div>

          {/* Canvas */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* Green light pooled behind whatever the canvas is showing. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ background: 'radial-gradient(60% 60% at 55% 45%, rgb(var(--c-green) / 0.10), transparent 70%)' }}
            />
            <div className="flex h-11 flex-shrink-0 items-center gap-1.5 border-b border-border-soft px-3.5">
              {['Zone', 'State', 'LGA'].map((f) => (
                <span
                  key={f}
                  className="rounded-md border border-border bg-bg-elev-2 px-2 py-[3px] text-[10px] font-semibold text-muted"
                >
                  {f}
                </span>
              ))}
            </div>

            {/* Keyed so each section's canvas mounts fresh. Deliberately NOT
                animated: the rail switches on hover, so an instant swap tracks
                the pointer better than a cross-fade — and the canvas never
                depends on an animation having run in order to be visible. */}
            <div className="min-h-0 flex-1 p-4">
              <div key={activeTo} className="h-[248px] sm:h-[292px]">
                <Canvas />
              </div>
            </div>

            {/* The way in — always points at whatever is on screen. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-[11.5px] text-muted">{active.description}</p>
              <Link
                to={active.to}
                className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                Open {active.label}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */
export function HomePage() {
  const viewCount = useMemo(
    () => SIDEBAR_NAV.reduce((a, e) => a + (isNavGroup(e) ? e.items.length : 1), 0),
    []
  );

  const QUESTIONS = [
    { n: '01', q: 'Is it ready?', to: '/app/readiness', d: 'Infrastructure, workforce, financing flows and the governance and data systems behind them.' },
    { n: '02', q: 'Is it stocked?', to: '/app/stock', d: 'Tracer commodities, equipment, cold-chain integrity and vaccine stock-out signals.' },
    { n: '03', q: 'Is it delivering?', to: '/app/service', d: 'Uptake of RMNCAH+N services, maternal and child outcomes, and health security.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/75 backdrop-blur-xl">
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

      {/* ============================================================ *
       * SECTION 1 — Explore the platform, inside the platform.
       * ============================================================ */}
      {/* No bottom border: a hard rule here made the page read as two stacked
          slabs. The brand wash simply fades out instead, so section 2 continues
          the same surface rather than starting a new one.
          The green is intentionally strong — this is a green programme, and the
          landing page should read as one at a glance. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand/[0.09] via-brand/[0.035] to-transparent">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(62% 55% at 50% -8%, rgb(var(--c-green) / 0.30), transparent 62%)' }}
        />
        <div className="relative mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-brand-bright">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-bright" />
              National PHC decision-support platform
            </span>
            <h1 className="mt-5 text-[2.4rem] font-extrabold leading-[1.06] tracking-tight text-text sm:text-[3.4rem]">
              Every state, scored.{' '}
              <span className="bg-gradient-to-r from-brand-bright via-brand to-brand-dark bg-clip-text text-transparent">
                Every gap, visible.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-text-soft">
              Primary Health Care across all {ALL_STATES.length} states and {viewCount} analysis views. Take the rail
              below for a spin — every section previews right here, then opens where you need it.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-12 max-w-[1080px]"
          >
            <Explorer />
          </motion.div>
        </div>
      </section>

      {/* ============================================================ *
       * SECTION 2 — The three questions the platform is built around.
       * ============================================================ */}
      <section className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-brand-bright">Three questions</h2>
        <p className="mt-2 max-w-2xl text-xl font-extrabold tracking-tight text-text sm:text-2xl">
          Every indicator on this platform answers one of them.
        </p>

        {/* A connected flow, not a stack of rows: the three questions are
            genuinely sequential — a facility has to be ready before being
            stocked means anything, and both before it can deliver. */}
        <div className="relative mt-12">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-[22px] hidden h-px bg-gradient-to-r from-brand/40 via-brand/40 to-brand/10 sm:block"
          />
          <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {QUESTIONS.map((q, i) => (
              <motion.li
                key={q.n}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative"
              >
                <Link to={q.to} className="group block focus-visible:outline-none">
                  {/* Sits ON the connector; solid background so the line reads
                      as passing behind the marker rather than through it. */}
                  <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-brand/30 bg-bg text-[12px] font-bold tabular-nums text-brand-bright transition-all group-hover:scale-105 group-hover:border-brand/60 group-hover:bg-brand/10">
                    {q.n}
                  </span>
                  <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-text transition-colors group-hover:text-brand-bright">
                    {q.q}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{q.d}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-bright">
                    Explore
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <p className="text-center font-semibold text-text-soft">Powered by SCIDaR</p>
          <p className="text-center sm:text-right">
            PHC performance data for decision-support. © {new Date().getFullYear()} NPHCDA.
          </p>
        </div>
      </footer>
    </div>
  );
}
