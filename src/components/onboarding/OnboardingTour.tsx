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
  // ── Home ──
  {
    anchor: 'logo',
    route: '/app/overview',
    title: 'The NPHCDA logo — your way home',
    body: 'The logo at the top of the sidebar returns you to the landing page at any time.',
  },
  // ── Pages: each nav link, with its in-page features straight after ──
  {
    anchor: 'nav-overview',
    route: '/app/overview',
    title: 'Overview',
    body: 'The national headline dashboard — key outcomes, coverage and the interactive state map. Click to view.',
  },
  {
    anchor: 'exec-pdf',
    route: '/app/overview',
    title: 'Executive PDF report',
    body: 'Generate a branded, multi-page PDF of the headline metrics and map — ready to share or print.',
  },
  {
    anchor: 'nav-readiness',
    route: '/app/readiness',
    title: 'Facility Readiness',
    body: 'Infrastructure, workforce, financing flows and governance across every facility. Click to view.',
  },
  {
    anchor: 'strongest',
    route: '/app/readiness',
    title: 'Strongest indicator',
    body: 'The best-performing indicator in this dashboard (goodness-aware) — a quick read on what’s working.',
  },
  {
    anchor: 'needs-attention',
    route: '/app/readiness',
    title: 'Needs attention',
    body: 'The weakest indicator in this dashboard — where to focus first.',
  },
  {
    anchor: 'block-export',
    route: '/app/readiness',
    title: 'Export',
    body: 'Export lives on most pages and adapts to each: here it downloads the indicator rows as CSV; on the Overview map it saves the map as PNG/PDF; on the league and scorecard tables it exports the ranked rows. Same button, page-appropriate output.',
  },
  {
    anchor: 'nav-stock',
    route: '/app/stock',
    title: 'Stock Status',
    body: 'Tracer commodities, equipment, cold-chain and vaccine stock-out signals. Click to view.',
  },
  {
    anchor: 'nav-service',
    route: '/app/service',
    title: 'Service Delivery',
    body: 'Uptake of RMNCAH+N services, maternal and child outcomes, and health security. Click to view.',
  },
  {
    anchor: 'nav-trends',
    route: '/app/trends',
    title: 'Trend Analysis',
    body: 'Compare indicators over time — monthly, quarterly or yearly, scope-aware, with real gaps left as gaps. Click to view.',
  },
  {
    anchor: 'nav-facilities',
    route: '/app/facilities',
    title: 'Facility Deepdive',
    body: 'A searchable State → LGA → Facility matrix across the assessed roster and the PFMO registry. Click to view.',
  },
  {
    anchor: 'nav-sources',
    route: '/app/sources',
    title: 'Source Dashboards',
    body: 'The linked source dashboards feeding the platform, each with its freshness and lineage so every figure is traceable. Click to view.',
  },
  {
    anchor: 'nav-other-analysis',
    title: 'Other Analysis',
    body: 'Five deeper tools are folded in here: Scorecard (A–F grades), League Tables (rankings), Data Quality (completeness & outliers), Equity Analysis (zones & donor split) and Compare Scopes (states side by side).',
  },
  // ── Ribbon: collapse, then left → right across the header ──
  {
    anchor: 'collapse',
    title: 'Collapse the sidebar',
    body: 'Shrink the navigation to an icon-only rail to hand more width to the page — toggle it back any time.',
  },
  {
    anchor: 'filters',
    title: 'Filter & scope everything',
    body: 'Set a global scope — zone, state, LGA, ward, facility type, facility, donor, source or period. It combines with AND, flows through every page, and becomes a shareable deep link.',
  },
  {
    anchor: 'freshness',
    title: 'Know how fresh the data is',
    body: 'The snapshot date and its age. Every figure on the platform is real, sourced data refreshed on a monthly cadence.',
  },
  {
    anchor: 'search',
    title: 'Search anything',
    body: 'Jump to any page, indicator or facility. The ⌘K / Ctrl-K shortcut opens it from anywhere.',
  },
  {
    anchor: 'help',
    title: 'Help is always here',
    body: 'Reopen this tour or the full written guide any time from the “?” menu.',
  },
  {
    anchor: 'notifications',
    title: 'Alerts, derived from the data',
    body: 'Below-target indicators, weak (D/F) states, data gaps and stale-snapshot warnings — each deep-links straight to where it matters. “View all” opens the full centre.',
  },
  {
    anchor: 'display',
    title: 'Make it readable for you',
    body: 'Toggle a colour-blind-safe (viridis) heat scale app-wide, and switch between light and dark themes.',
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
  // The callout is only shown once the target is measured — never at screen-centre
  // mid-transition — so it moves straight to each feature instead of flashing centre.
  const [ready, setReady] = useState(false);

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

  // Locate + measure the target element, polling until it mounts. The callout stays
  // hidden (not centred) until `ready` flips, so it never flashes at screen-centre
  // before sliding to the feature. Elements already on screen are measured at once
  // (no scroll-settle); only off-screen targets are scrolled into view first.
  useEffect(() => {
    if (!open) {
      setRect(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    let tries = 0;
    setReady(false);
    const commit = (el: HTMLElement) => {
      if (cancelled) return;
      setRect(el.getBoundingClientRect());
      setReady(true);
    };
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const inView = r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
        if (inView) {
          commit(el); // already visible → no scroll, no centre flash
          return;
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.setTimeout(() => {
          const settled = document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`);
          if (settled) commit(settled);
        }, 280);
        return;
      }
      if (tries++ > 40) {
        setRect(null);
        setReady(true); // give up → centred fallback callout
        return;
      }
      window.setTimeout(tick, 100);
    };
    const t = window.setTimeout(tick, 120);
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

  // Callout position: beside the target if we have one, else centred. Both the
  // below- and above-target placements are expressed as `top` + a translateY so the
  // callout can transition (glide) between steps — mixing `top`/`bottom` would break
  // the animation. Above-placement uses translateY(-100%) to sit on the target's top
  // edge without needing the callout's measured height.
  let tipStyle: React.CSSProperties;
  if (rect) {
    const placeBelow = vh - rect.bottom > 240 || vh - rect.bottom >= rect.top;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - TIP_W / 2, PAD), vw - TIP_W - PAD);
    tipStyle = placeBelow
      ? { top: rect.bottom + GAP, left, transform: 'translateY(0)' }
      : { top: rect.top - GAP, left, transform: 'translateY(-100%)' };
  } else {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Spotlight: the highlight box carries the dim (huge spread shadow) + a ring.
          It stays mounted across steps and eases to each new target, so the dim never
          flashes flat and the highlight glides instead of blinking. Only before the
          very first measurement (no rect yet) do we fall back to a plain dim. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-[400ms] ease-in-out"
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

      {/* Callout — cross-fades between steps rather than popping out. It stays mounted
          and fades to 0 while the next target is being measured, then fades back in at
          its new position, so the content swap is hidden behind the fade. */}
      <div
        className={`absolute w-[340px] max-w-[calc(100vw-20px)] rounded-card border border-border bg-bg-elev p-4 shadow-pop transition-all duration-[250ms] ease-out ${
          ready ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
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

        {/* Dots and nav sit on separate rows: with 20 steps they can't share one
            row inside a 340px card without pushing the buttons out of the box. */}
        <div className="mt-3.5 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-brand' : 'w-1.5 bg-border hover:bg-muted-2'}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5">
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
