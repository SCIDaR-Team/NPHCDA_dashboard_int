import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HelpCircle, PlayCircle, Keyboard, GraduationCap, BookOpen, ArrowRight, ChevronRight } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { useOnboardingStore } from '@/store/onboardingStore';
import { TOPBAR_ICON_BTN } from './topbarStyles';

/** Quick jumps into the full guide's sections. */
const QUICK_LINKS: { label: string; hash: string }[] = [
  { label: 'Filtering & scoping', hash: 'scoping' },
  { label: 'Scorecard & grading', hash: 'scorecard' },
  { label: 'League tables & movement', hash: 'league' },
  { label: 'Data quality', hash: 'data-quality' },
  { label: 'Targets & variance', hash: 'targets' },
  { label: 'Methodology', hash: 'methodology' },
  { label: 'Glossary', hash: 'glossary' },
];

/** The "?" topbar button that opens the quick-help drawer. */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const startTour = useOnboardingStore((s) => s.start);
  const navigate = useNavigate();
  const location = useLocation();

  // Always close the drawer when the route (or in-page anchor) changes — so opening
  // the full guide, or any deep-link into it, leaves the drawer closed behind it.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  const goGuide = (hash?: string) => {
    const to = hash ? `/app/help#${hash}` : '/app/help';
    // Close the drawer first, then open the full guide on the next frame. Navigating
    // in the same tick makes the new page's render step on the drawer's exit, so it
    // appears to "refuse" to close — deferring gives a clean close-then-open.
    setOpen(false);
    requestAnimationFrame(() => navigate(to));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Help & guide"
        aria-label="Open help and guide"
        className={TOPBAR_ICON_BTN}
      >
        <HelpCircle size={19} strokeWidth={2.25} />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} side="right" width={400} title="Help & guide" subtitle="Quick answers — or open the full guide">
        <div className="space-y-5 text-sm">
          {/* Primary actions. */}
          <div className="grid gap-2">
            <button
              onClick={() => goGuide()}
              className="flex items-center justify-between rounded-lg bg-brand px-3.5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-bright"
            >
              <span className="flex items-center gap-2">
                <BookOpen size={16} /> Open the full guide
              </span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                setOpen(false);
                startTour();
              }}
              className="flex items-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm font-bold text-text transition-colors hover:border-brand/50 hover:text-brand-bright"
            >
              <PlayCircle size={16} /> Replay the guided tour
            </button>
          </div>

          {/* Jump into a topic (deep-links into the full guide). */}
          <section>
            <h4 className="mb-1.5 text-[13px] font-bold text-text">Jump to a topic</h4>
            <div className="overflow-hidden rounded-lg border border-border-soft">
              {QUICK_LINKS.map((l) => (
                <button
                  key={l.hash}
                  onClick={() => goGuide(l.hash)}
                  className="flex w-full items-center justify-between border-b border-border-soft px-3 py-2 text-left text-[13px] text-text-soft transition-colors last:border-0 hover:bg-bg-elev-2 hover:text-text"
                >
                  {l.label}
                  <ChevronRight size={14} className="text-muted-2" />
                </button>
              ))}
            </div>
          </section>

          {/* At-a-glance essentials that don't need a full page trip. */}
          <section>
            <h4 className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-text">
              <GraduationCap size={15} className="text-brand-bright" /> Grades at a glance
            </h4>
            <p className="leading-relaxed text-muted">
              Each scope is scored 0–100 per building block, block-weighted into an overall composite and graded
              A ≥ 80 · B ≥ 67 · C ≥ 50 · D ≥ 34 · F &lt; 34. Click any grade to see how it was calculated.
            </p>
          </section>

          <section>
            <h4 className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-text">
              <Keyboard size={15} className="text-brand-bright" /> Keyboard shortcuts
            </h4>
            <ul className="space-y-1.5 text-muted">
              <li className="flex items-center justify-between">
                <span>Global search</span>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px]">⌘K / Ctrl-K</kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>Add a note (in the notes box)</span>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px]">⌘/Ctrl + Enter</kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>Close a dialog / drawer</span>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px]">Esc</kbd>
              </li>
            </ul>
          </section>
        </div>
      </Drawer>
    </>
  );
}
