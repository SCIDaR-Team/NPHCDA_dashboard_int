import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowLeft, BookOpen, X } from 'lucide-react';
import { useOnboardingStore } from '@/store/onboardingStore';

/**
 * In-product coach-mark tour. Each step points at a real element via its
 * `data-tour="…"` anchor: the engine navigates to that element's page if needed,
 * polls until it mounts (lazy pages / data load), scrolls it into view, then dims the
 * screen and cuts a spotlight around it with a callout beside it. Missing targets are
 * skipped gracefully (the callout centres instead) so the tour can never get stuck.
 */
interface Step {
  anchor: string;
  route?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    anchor: 'nav',
    route: '/app/overview',
    title: 'Find your way around',
    body: 'Every page lives here — the dashboards, the analytics (Scorecard, League, Data Quality, Equity, Compare) and Source Dashboards. Below the links you’ll find your Saved views and Recently viewed.',
  },
  {
    anchor: 'filters',
    title: 'Filter & scope everything',
    body: 'Set a global scope — zone, state, LGA, ward, facility type, facility, donor, source or period. It combines with AND and flows through every page, and becomes a shareable deep link.',
  },
  {
    anchor: 'search',
    title: 'Search anything',
    body: 'Jump to any page, indicator or facility. The ⌘K / Ctrl-K shortcut opens it from anywhere.',
  },
  {
    anchor: 'freshness',
    title: 'Know how fresh the data is',
    body: 'The snapshot date and its age. Every figure on the platform is real, sourced data refreshed on a monthly cadence.',
  },
  {
    anchor: 'notifications',
    title: 'Alerts, derived from the data',
    body: 'Below-target indicators, weak (D/F) states, data gaps and stale-snapshot warnings — each deep-links straight to where it matters. “View all” opens the full centre.',
  },
  {
    anchor: 'help',
    title: 'Help is always here',
    body: 'Reopen this tour or the full written guide any time from the “?” menu.',
  },
  {
    anchor: 'display',
    title: 'Make it readable for you',
    body: 'Toggle a colour-blind-safe (viridis) heat scale app-wide, and switch between light and dark themes.',
  },
  {
    anchor: 'kpi',
    route: '/app/overview',
    title: 'Overview — the headline metrics',
    body: 'Key outcomes and coverage, grouped by theme. Each card has a copy/cite button and, where a national target exists, its variance.',
  },
  {
    anchor: 'map',
    title: 'The national map',
    body: 'Colour states by the composite readiness score or any single indicator, switch to an accessible sortable table, and export as PNG/PDF. Click a state for its cross-block profile.',
  },
  {
    anchor: 'indicators',
    route: '/app/readiness',
    title: 'The three thematic dashboards',
    body: 'Facility Readiness, Stock Status and Service Delivery hold the full indicator set. Open any card for its deep-dive: definition, source lineage, freshness and per-state / per-facility breakdowns.',
  },
  {
    anchor: 'page-title',
    route: '/app/trends',
    title: 'Trend Analysis',
    body: 'Compare indicators over time at monthly, quarterly or yearly granularity — scope-aware, with real gaps left as gaps.',
  },
  {
    anchor: 'universe',
    route: '/app/facilities',
    title: 'Facility Deepdive',
    body: 'A searchable State → LGA → Facility matrix across two universes — the assessed roster and the PFMO registry. Click a facility name to open its full profile.',
  },
  {
    anchor: 'scorecard',
    route: '/app/scorecard',
    title: 'Scorecard — grade everything A–F',
    body: 'Composite grades and a traffic-light matrix for the nation, every state and LGA. Click any grade to open the calculation drawer and see exactly which indicators produced it.',
  },
  {
    anchor: 'league',
    route: '/app/league',
    title: 'League Tables',
    body: 'Rank states, LGAs and facilities by composite or any indicator, best or worst first, with year-over-year movement where periodic data exists.',
  },
  {
    anchor: 'dq',
    route: '/app/data-quality',
    title: 'Data Quality',
    body: 'Completeness, timeliness, small samples and outliers across every indicator, plus per-source freshness and the list of data gaps.',
  },
  {
    anchor: 'page-title',
    route: '/app/equity',
    title: 'Equity Analysis',
    body: 'Compare performance across geopolitical zones and donor-supported vs non-donor states, with the equity gap between the best and worst group.',
  },
  {
    anchor: 'page-title',
    route: '/app/compare',
    title: 'Compare Scopes',
    body: 'Put National and up to four states side by side — small-multiples of their grades and sub-scores, plus a side-by-side indicator table.',
  },
  {
    anchor: 'page-title',
    route: '/app/sources',
    title: 'Source Dashboards',
    body: 'The linked source dashboards feeding the platform, each with its freshness and lineage so every figure is traceable.',
  },
  {
    anchor: 'help',
    title: 'You’re all set',
    body: 'That’s the whole platform. Reopen this tour or the full guide from the “?” menu — the guide has exhaustive, per-feature detail whenever you need it.',
  },
];

const GAP = 12;
const TIP_W = 340;
const PAD = 10;

export function OnboardingTour() {
  const open = useOnboardingStore((s) => s.open);
  const maybeStart = useOnboardingStore((s) => s.maybeStart);
  const finish = useOnboardingStore((s) => s.finish);
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    maybeStart();
  }, [maybeStart]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const s = STEPS[step];

  // Navigate to the step's page if we're not already there.
  useEffect(() => {
    if (!open || !s.route) return;
    if (!location.pathname.startsWith(s.route)) navigate(s.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  // Locate + measure the target element, polling until it mounts.
  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let tries = 0;
    setRect(null);
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.setTimeout(() => {
          if (!cancelled) setRect(el.getBoundingClientRect());
        }, 280);
        return;
      }
      if (tries++ > 40) {
        setRect(null); // give up → centred fallback callout
        return;
      }
      window.setTimeout(tick, 100);
    };
    const t = window.setTimeout(tick, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  // Keep the spotlight glued to the element on scroll / resize.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  // Esc skips the tour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!open) return null;

  const last = step === STEPS.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Callout position: beside the target if we have one, else centred.
  let tipStyle: React.CSSProperties;
  if (rect) {
    const placeBelow = vh - rect.bottom > 240 || vh - rect.bottom >= rect.top;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - TIP_W / 2, PAD), vw - TIP_W - PAD);
    tipStyle = placeBelow
      ? { top: rect.bottom + GAP, left }
      : { bottom: vh - rect.top + GAP, left };
  } else {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Spotlight: the highlight box carries the dim (huge spread shadow) + a ring. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 3px rgba(16,94,74,0.95), 0 0 0 9999px rgba(2,6,23,0.62)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(2,6,23,0.62)]" />
      )}

      {/* Callout. */}
      <div
        className="absolute w-[340px] max-w-[calc(100vw-20px)] rounded-card border border-border bg-bg-elev p-4 shadow-pop"
        style={tipStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-2">
            Step {step + 1} of {STEPS.length}
          </span>
          <button onClick={finish} aria-label="Skip tour" className="rounded p-0.5 text-muted transition-colors hover:text-text">
            <X size={15} />
          </button>
        </div>
        <h3 className="mt-1 text-[15px] font-extrabold text-text">{s.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.body}</p>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-brand' : 'w-1.5 bg-border hover:bg-muted-2'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={() => setStep((n) => Math.max(0, n - 1))}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-text"
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
            {last ? (
              <>
                <button
                  onClick={() => {
                    // Close the tour first, then open the full guide next frame so the
                    // overlay's teardown doesn't collide with the new page's render.
                    finish();
                    requestAnimationFrame(() => navigate('/app/help'));
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-semibold text-text transition-colors hover:border-brand/50 hover:text-brand-bright"
                >
                  <BookOpen size={13} /> Full guide
                </button>
                <button onClick={finish} className="rounded-lg bg-brand px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-brand-bright">
                  Done
                </button>
              </>
            ) : (
              <button
                onClick={() => setStep((n) => Math.min(n + 1, STEPS.length - 1))}
                className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-brand-bright"
              >
                Next <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
