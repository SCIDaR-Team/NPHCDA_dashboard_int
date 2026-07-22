import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  HeartPulse,
  Package,
  Stethoscope,
  TrendingUp,
  Table2,
  ClipboardCheck,
  ListOrdered,
  ShieldCheck,
  Scale,
  Columns3,
  LayoutGrid,
  Filter,
  Search,
  Bell,
  StickyNote,
  FileText,
  Download,
  Target,
  GraduationCap,
  BookMarked,
  Building2,
  Eye,
  Compass,
  PanelTop,
  SlidersHorizontal,
  Sun,
  Clock,
  HelpCircle,
  Microscope,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

interface ControlRow {
  icon: LucideIcon;
  name: string;
  desc: string;
}

interface HelpSection {
  id: string;
  icon: LucideIcon;
  title: string;
  /** Lead paragraph. */
  lead: string;
  /** Bullet points — the concrete controls / behaviours on that surface. */
  points?: string[];
  /** Icon-annotated control rows (top-bar chrome), each highlighting its ribbon icon. */
  controls?: ControlRow[];
}

const SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    icon: Compass,
    title: 'Getting started',
    lead: 'The NPHCDA PHC Intelligence Platform is a national view of Primary Health Care readiness, stock and service delivery, built entirely on real, sourced data. Nothing is fabricated: where a scope has no measurement you see “—”, never a zero.',
    points: [
      'Use the left sidebar to move between pages; the logo returns you to the home entry page.',
      'The “Data as of” chip in the top bar shows when the current snapshot was generated.',
      'Press the “?” icon any time for the quick guide, or replay the guided tour from there.',
    ],
  },
  {
    id: 'top-bar',
    icon: PanelTop,
    title: 'Top bar & controls',
    lead: 'Every page shares the top bar. These controls are always one click away — match the icon here to the one in the ribbon.',
    controls: [
      { icon: SlidersHorizontal, name: 'Filters', desc: 'Open the global scope drawer; a badge shows how many filters are active.' },
      { icon: Search, name: 'Search (⌘K / Ctrl-K)', desc: 'Jump to any page, indicator or facility.' },
      { icon: Clock, name: 'Data as of', desc: 'The date the current data snapshot was generated, with its relative age.' },
      { icon: HelpCircle, name: 'Help & guide', desc: 'Opens the quick help drawer — replay the tour or open this full guide.' },
      { icon: Bell, name: 'Notifications', desc: 'Alerts derived from the snapshot; the badge counts unread items.' },
      { icon: Eye, name: 'Colour-blind-safe scale', desc: 'Toggles the viridis heat scale app-wide for red–green colour-vision deficiency.' },
      { icon: Sun, name: 'Light / dark theme', desc: 'Switches the whole platform between light and dark mode (Sun / Moon).' },
    ],
  },
  {
    id: 'scoping',
    icon: Filter,
    title: 'Filtering & scoping',
    lead: 'A single global scope flows through every page. Open Filters (top-left) to narrow to a zone, state, LGA, ward, facility type, facility, donor, data source, or period — they combine with AND into one real figure for the intersection.',
    points: [
      'The active scope shows as a “Scoped: …” badge in the top bar; cards, KPIs and charts re-derive to that scope.',
      'A scope with no data for an indicator shows an explicit “Out of scope” / “No data” state — never a fabricated value.',
      'The scope is reflected in the URL, so any filtered view is a shareable deep link.',
      'Save a scope + page as a “Saved view” to jump back to it later (see the sidebar).',
    ],
  },
  {
    id: 'search-recent',
    icon: Search,
    title: 'Search, saved views & recently viewed',
    lead: 'Find anything fast and get back to where you were.',
    points: [
      'Press ⌘K / Ctrl-K (or the Search button) for global search across pages, indicators and facilities.',
      'Saved views (sidebar) bookmark a page + filter scope.',
      'Recently viewed (sidebar) lists the indicators and facilities you last opened.',
    ],
  },
  {
    id: 'overview',
    icon: LayoutDashboard,
    title: 'Overview',
    lead: 'The top-level picture: outcomes, coverage and system/trust indicators, plus the interactive national map.',
    points: [
      'KPI strip: headline figures grouped by theme, each with a copy/cite button and — where a target exists — its variance vs the national target.',
      'State map: colour by the composite readiness score (default) or any single indicator. Toggle a sortable, accessible table view; states are keyboard-operable.',
      'Click a state for its cross-block profile, or scope the whole dashboard to it.',
      'Export the map as PNG/PDF (title baked in); generate the Executive PDF from the header.',
    ],
  },
  {
    id: 'readiness',
    icon: HeartPulse,
    title: 'Facility Readiness (thematic dashboard)',
    lead: 'The first of the three thematic dashboards: infrastructure, workforce, financing flows and governance/data systems — whether a facility is equipped to deliver care.',
    points: [
      'Indicator cards grouped into sections (functionality & infrastructure, workforce, financing, governance).',
      'Strongest / needs-attention chips in the header summarise the block at a glance.',
    ],
  },
  {
    id: 'stock',
    icon: Package,
    title: 'Stock Status (thematic dashboard)',
    lead: 'The second thematic dashboard: tracer commodities, the PPH bundle, cold-chain and vaccine stock signals.',
    points: ['Composite commodity cards (e.g. all six tracer commodities) show the share of facilities fully stocked, with the item-by-item breakdown behind the info tooltip.'],
  },
  {
    id: 'service',
    icon: Stethoscope,
    title: 'Service Delivery (thematic dashboard)',
    lead: 'The third thematic dashboard: uptake of RMNCAH+N services and maternal/child outcomes.',
    points: ['Coverage indicators (ANC, skilled birth attendance, immunisation) sit alongside outcome indicators (MMR, U5MR and cause-of-death shares).'],
  },
  {
    id: 'deep-dive',
    icon: Microscope,
    title: 'Indicator deep-dive',
    lead: 'Open any indicator card (on the three thematic dashboards or the Overview) for its deep-dive.',
    points: [
      'Definition & calculation (numerator / denominator), source lineage, freshness and — where targeted — variance vs the national target.',
      'Real per-state and per-facility breakdowns you can sort, filter and export as an image.',
      'Add notes to the indicator here (see Annotations).',
    ],
  },
  {
    id: 'trends',
    icon: TrendingUp,
    title: 'Trend Analysis',
    lead: 'Compare indicators over time at monthly, quarterly or yearly granularity. Under an active geography/type/donor scope, the series honestly recomputes for that scope; a period filter doesn’t apply to a time series.',
    points: ['Gaps in a series are real (a period with no data) and shown as gaps, never interpolated.'],
  },
  {
    id: 'facility-deepdive',
    icon: Table2,
    title: 'Facility Deepdive & facility profiles',
    lead: 'A searchable State → LGA → Facility matrix across two distinct universes: the assessed roster (SRH/SFM) and the PFMO national reporting registry.',
    points: [
      'Switch universes with the toggle; each has its own columns, filters and KPIs.',
      'Local State / LGA / search controls layer on top of the global scope; group by state; paginate large sets.',
      'Click a facility name (assessed matrix or the facility league) to open its Facility Profile — a readiness index, every per-facility indicator by block, donors, and a notes panel.',
    ],
  },
  {
    id: 'scorecard',
    icon: ClipboardCheck,
    title: 'Scorecard',
    lead: 'Turns indicators into an A–F grade and a traffic-light matrix for the nation, every state and every LGA.',
    points: [
      'National grade band shows the overall composite plus the three block sub-scores (Readiness, Stock, Service).',
      'Matrix: switch between states and a chosen state’s LGAs; sort any column; cells are coloured on the shared heat scale.',
      'Click any grade to open the calculation drawer — the exact indicators and their goodness that produced it.',
      'Click a scope to filter the whole platform to it; export the matrix.',
    ],
  },
  {
    id: 'league',
    icon: ListOrdered,
    title: 'League Tables',
    lead: 'Rank states, LGAs or facilities by the overall composite or any single indicator — best or worst first.',
    points: [
      'Year-over-year movement is shown where periodic data exists, inverse-aware (a fall in mortality reads as an improvement).',
      'Facilities rank within a chosen state and link through to the facility profile.',
    ],
  },
  {
    id: 'data-quality',
    icon: ShieldCheck,
    title: 'Data Quality',
    lead: 'Completeness, timeliness, missing data, small samples and outliers — computed from the same real measurements the rest of the platform uses.',
    points: [
      'Headline KPIs: indicators with a live source, mean state completeness, small-sample and outlier flags.',
      'Per-source timeliness/freshness from the snapshot; a sortable completeness & reliability table; and a data-gaps panel for unsourced indicators.',
      'Outliers use a 1.5×IQR fence; small samples fall below the reliability threshold.',
    ],
  },
  {
    id: 'equity',
    icon: Scale,
    title: 'Equity Analysis',
    lead: 'Compares performance across equity strata — geopolitical zone and donor-supported vs non-donor states — to surface who is being left behind.',
    points: [
      'Each group’s figure is the mean per-state performance of its measured states; the equity gap is the spread between the best and worst group.',
      'Rural/urban isn’t carried by any current source, so it isn’t shown (only real strata are compared).',
    ],
  },
  {
    id: 'compare',
    icon: Columns3,
    title: 'Compare Scopes',
    lead: 'Put National and up to four states side by side.',
    points: [
      'Small-multiples grid: each scope’s composite grade and block sub-score bars.',
      'Side-by-side indicator table marks the strongest scope in each row.',
    ],
  },
  {
    id: 'sources',
    icon: LayoutGrid,
    title: 'Source Dashboards',
    lead: 'The linked source dashboards feeding this platform, each with its freshness and lineage, so every figure is traceable to where it came from.',
  },
  {
    id: 'targets',
    icon: Target,
    title: 'Targets, benchmarks & variance',
    lead: 'Targeted percentage indicators carry a variance chip — “Target 95% · −8.6 pts” — green when at/above the national target, red when below.',
    points: ['Targets are national policy benchmarks (clearly labelled), not measured data; adjust them in one registry.'],
  },
  {
    id: 'report',
    icon: FileText,
    title: 'Executive PDF report',
    lead: 'One click (Overview or Scorecard header) produces a multi-section national briefing: national grade + sub-scores, data-quality summary, best/weakest states, and key indicators vs targets with colour-coded variance.',
  },
  {
    id: 'annotations',
    icon: StickyNote,
    title: 'Annotations / notes',
    lead: 'Attach free-text notes to any indicator (from its deep-dive) or facility (on its profile) — context, caveats or follow-ups.',
    points: ['Notes persist in your browser with author and timestamp; press ⌘/Ctrl+Enter to add.'],
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notification centre',
    lead: 'The bell surfaces alerts derived from the current snapshot: indicators far below target, weak (D/F) states, data gaps, quality flags and a stale-snapshot warning.',
    points: [
      'Each alert deep-links to the relevant page; click to open and mark read.',
      '“View all” opens the full centre with an all/unread filter, per-item dismiss and bulk actions.',
    ],
  },
  {
    id: 'exports',
    icon: Download,
    title: 'Exporting',
    lead: 'Most pages have an Export menu: download the current table as CSV or Excel. Charts and the map also export as PNG/PDF with an export-only title baked into the file.',
  },
  {
    id: 'accessibility',
    icon: Eye,
    title: 'Accessibility & display',
    lead: 'Built for everyone.',
    points: [
      'Colour-blind-safe (viridis) heat scale toggle in the top bar, applied app-wide.',
      'Light / dark theme toggle. The map and tables are keyboard-operable with accessible fallbacks.',
      '⌘K / Ctrl-K search · Esc closes dialogs · ⌘/Ctrl+Enter submits a note.',
    ],
  },
  {
    id: 'methodology',
    icon: GraduationCap,
    title: 'Methodology',
    lead: 'How the scores are built.',
    points: [
      'Goodness: each indicator on a 0–100 “higher is better” scale — inverse indicators (mortality, stock-out, zero-dose) are flipped first.',
      'Block sub-score: the mean goodness of a block’s gradeable indicators that have real data for the scope. Raw counts (“Number of …”) are excluded so the scale stays comparable.',
      'Composite: the block-weighted mean of the available sub-scores.',
      'Grades: A ≥ 80, B ≥ 67, C ≥ 50, D ≥ 34, F < 34.',
      'Reliability: figures from fewer records than the threshold are flagged “small n”; statistical outliers use a 1.5×IQR fence.',
    ],
  },
  {
    id: 'glossary',
    icon: BookMarked,
    title: 'Glossary',
    lead: 'Key terms used across the platform.',
    points: [
      'Composite score — block-weighted mean 0–100 performance, mapped to a grade.',
      'Tracer commodities — six essential PHC commodities; a facility passes only if all six are in stock.',
      'BEmONC / CEmONC — Basic / Comprehensive Emergency Obstetric & Newborn Care service levels.',
      'BHCPF — Basic Health Care Provision Fund, the national PHC financing gateway.',
      'Zero-dose — children who received no routine vaccine (lower is better).',
      'MMR / U5MR — Maternal Mortality Ratio / Under-5 Mortality Rate.',
    ],
  },
  {
    id: 'data-sources',
    icon: Building2,
    title: 'Data & trust',
    lead: 'Every figure is real, sourced data refreshed on a monthly cadence. Targets are labelled policy benchmarks. The Data Quality page and per-indicator lineage let you trace and trust every number.',
  },
];

/** Matches the nav's `top-28` sticky offset and the cards' `scroll-mt-28`. */
const HEADER_OFFSET = 112;

export function HelpPage() {
  const location = useLocation();
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  // The right-hand cards are their own scroll container, independent of the TOC.
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  // Briefly suppress scroll-spy right after a click so the smooth scroll doesn't
  // flicker the highlight through the sections it passes on the way.
  const lockUntil = useRef(0);

  // The on-screen Y of a section's nav item — the row we align the section to.
  const targetRowY = (id: string) => itemRefs.current[id]?.getBoundingClientRect().top ?? HEADER_OFFSET;

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    const container = contentRef.current;
    if (!el || !container) return;
    const delta = el.getBoundingClientRect().top - targetRowY(id);
    lockUntil.current = Date.now() + 700;
    setActive(id);
    container.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const onNavClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    window.history.replaceState(null, '', `#${id}`);
    scrollToSection(id);
  };

  // Honour a #section deep-link from the quick-help drawer — align it on the same row.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return;
    const t = window.setTimeout(() => scrollToSection(hash), 60);
    return () => window.clearTimeout(t);
  }, [location.hash, scrollToSection]);

  // Scroll-spy: highlight the deepest section that has reached its nav row, driven
  // by the cards pane's own scroll (not the window).
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    let raf = 0;
    const recompute = () => {
      raf = 0;
      if (Date.now() < lockUntil.current) return;
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - targetRowY(s.id) <= 4) current = s.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(recompute);
    };
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    // Fixed to the viewport (below the top bar) so the page itself never scrolls —
    // the TOC and the cards are the two independent scroll panes inside it.
    <div className="flex h-[calc(100dvh-7rem)] flex-col">
      <PageHeader
        title="Full guide"
        subtitle="A complete reference to every page and feature in the platform. Jump to a section, or read straight through."
      />

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Table of contents — its own scroll pane. */}
        <nav aria-label="Help contents" className="hidden min-h-0 overflow-y-auto pr-1 lg:block">
          <div className="space-y-0.5">
            {SECTIONS.map((s) => {
              const isActive = active === s.id;
              return (
                <a
                  key={s.id}
                  ref={(el) => {
                    itemRefs.current[s.id] = el;
                  }}
                  href={`#${s.id}`}
                  onClick={(e) => onNavClick(e, s.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-brand/12 font-semibold text-brand-bright'
                      : 'text-text-soft hover:bg-bg-elev-2 hover:text-text'
                  )}
                >
                  <s.icon size={14} className={cn('flex-shrink-0', isActive ? 'text-brand-bright' : 'text-muted-2')} />
                  <span className="truncate">{s.title}</span>
                </a>
              );
            })}
          </div>
        </nav>

        {/* Sections — its own scroll pane. */}
        <div ref={contentRef} className="min-h-0 space-y-4 overflow-y-auto pb-6 pr-1">
          {SECTIONS.map((s) => (
            <Card key={s.id} id={s.id} className="p-5">
              <h2 className="flex items-center gap-2.5 text-base font-extrabold text-text">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/12 text-brand-bright">
                  <s.icon size={16} />
                </span>
                {s.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{s.lead}</p>
              {s.points && (
                <ul className="mt-3 space-y-1.5">
                  {s.points.map((p, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-text-soft">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-bright" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.controls && (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {s.controls.map((c) => (
                    <li key={c.name} className="flex items-start gap-2.5 rounded-lg border border-border-soft bg-bg-elev-2/40 px-3 py-2">
                      {/* Icon chip mirrors how the control looks in the top bar. */}
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elev text-text-soft">
                        <c.icon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-text">{c.name}</span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{c.desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}

          <p className="px-1 py-2 text-center text-[12px] text-muted-2">
            Still stuck? Open the{' '}
            <Link to="/app/data-quality" className="font-semibold text-brand-bright hover:underline">
              Data Quality
            </Link>{' '}
            page to check source freshness, or revisit the guided tour from the “?” menu.
          </p>
        </div>
      </div>
    </div>
  );
}
