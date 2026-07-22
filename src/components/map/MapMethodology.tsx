import { useState } from 'react';
import { Info } from 'lucide-react';
import { Modal } from '@/components/ui';
import { PROFILE_INDICATOR_NAMES } from './stateProfile';
import { cleanName } from '@/lib/format';

interface MapMethodologyProps {
  /** Name of the single indicator currently colouring the map, if any. */
  activeIndicator?: string | null;
}

/**
 * Methodology affordance for the state map. The explanation stays out of the map
 * surface (and out of the exported PNG/PDF) — it is only revealed when the user
 * opens this dialog.
 */
/** Spelled-out counts, so the copy reads naturally and follows the real indicator list. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export function MapMethodology({ activeIndicator }: MapMethodologyProps) {
  const [open, setOpen] = useState(false);
  const n = PROFILE_INDICATOR_NAMES.length;
  const nWord = COUNT_WORDS[n] ?? String(n);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="How the composite score is calculated"
        className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <Info size={15} />
        Methodology
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="How the map score is worked out"
        subtitle="What the colour on each state actually means"
        size="max-w-2xl"
      >
        <div className="space-y-5 text-[13.5px] leading-relaxed text-muted">
          <section>
            <h4 className="mb-1.5 text-sm font-bold text-text">In one sentence</h4>
            <p>
              Each state gets a score out of 100 — its{' '}
              <span className="font-semibold text-text-soft">average report card</span> across the{' '}
              {nWord} health checks listed below. The higher the score, the deeper the colour on the
              map.
            </p>
          </section>

          <section>
            <h4 className="mb-1.5 text-sm font-bold text-text">How we get there</h4>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                We score the state out of 100 on each of the {nWord} health checks. For example, if
                8 out of 10 of its facilities have all six essential medicines, that check scores 80.
              </li>
              <li>
                A few checks measure something we want to be <em>low</em>, like maternal deaths. We
                flip those around so that fewer deaths gives a higher score. That way, on every
                check, a bigger number always means better.
              </li>
              <li>
                We add up the state's {nWord} scores and divide by {nWord} to get its average — that
                average is the score you see on the map.
              </li>
            </ol>
            <p className="mt-2.5 rounded-lg bg-bg-elev-2 px-3 py-2.5 text-[13px]">
              <span className="font-semibold text-text-soft">Example:</span> a state scoring 80, 60,
              90, 70, 50, 85, 75 and 62 on {n === 8 ? 'the eight checks' : 'its checks'} has an
              average of <span className="font-semibold text-text-soft">71.5</span> — so it is
              coloured as a 71.5 out of 100.
            </p>
            <p className="mt-2.5">
              No check counts for more than any other, and every state is scored the same way — so
              comparing two states on the map is a fair comparison.
            </p>
          </section>

          <section>
            <h4 className="mb-1.5 text-sm font-bold text-text">The {nWord} health checks</h4>
            <ul className="list-disc space-y-1 pl-5">
              {PROFILE_INDICATOR_NAMES.map((n) => (
                <li key={n}>{cleanName(n)}</li>
              ))}
            </ul>
            <p className="mt-2">
              Clicking any state opens its profile, which shows these same checks one by one — so you
              can see exactly what is driving its score.
            </p>
          </section>

          <section>
            <h4 className="mb-1.5 text-sm font-bold text-text">Why some states are grey</h4>
            <p>
              Grey means <span className="font-semibold text-text-soft">we have no figures yet</span>{' '}
              for that state — not that it scored zero. If a state is missing some checks but not
              all, we simply average the ones we do have rather than guessing at the rest.
            </p>
          </section>

          <section>
            <h4 className="mb-1.5 text-sm font-bold text-text">Looking at one check on its own</h4>
            <p>
              {activeIndicator ? (
                <>
                  Right now the map is showing{' '}
                  <span className="font-semibold text-text-soft">{cleanName(activeIndicator)}</span>{' '}
                  on its own, not the average. Each state is coloured by how it did on this one check
                  alone. Clear the picker above to go back to the combined score.
                </>
              ) : (
                <>
                  Pick a single indicator from the dropdown above and the map switches from the
                  combined score to that one check on its own — each state is then coloured purely by
                  how it did on that measure.
                </>
              )}
            </p>
          </section>

          <section>
            <h4 className="mb-1.5 text-sm font-bold text-text">The symbols on the map</h4>
            <p>
              The stars, circles, triangles and squares show which donor programmes are running in a
              state. They have no bearing on the score and do not change a state's colour.
            </p>
          </section>
        </div>
      </Modal>
    </>
  );
}
