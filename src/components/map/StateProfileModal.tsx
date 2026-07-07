import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { heatColor, coverageStates, stateMeasures } from '@/data/calculations';
import { FUNCTIONAL_STATUS_INDICATOR } from '@/data/scopedEngine';
import { STATE_DONORS } from '@/data/geo/states';
import { cleanName, decodeHtml } from '@/lib/format';
import { PROFILE_INDICATOR_NAMES, stateCompositeScore } from './stateProfile';
import type { Blocks, BlockName, Indicator } from '@/data/types';

interface Props {
  /** Which state to profile, or null when the modal is closed. */
  state: string | null;
  blocks: Blocks | null;
  onClose: () => void;
  /** Scope the whole dashboard to this state (bridges back to the filter). */
  onScope?: (state: string) => void;
}

interface ProfileRow {
  name: string;
  block: BlockName;
  /** Display string + goodness for this state, or null when unmeasured. */
  measure: { display: string; goodness: number } | null;
  inCoverage: boolean;
}

/** Name → building block, so the profile can label each curated indicator's block. */
function blockOfName(blocks: Blocks): Record<string, BlockName> {
  const m: Record<string, BlockName> = {};
  (Object.keys(blocks) as BlockName[]).forEach((bn) =>
    blocks[bn].forEach((i) => (m[i.name] = bn))
  );
  return m;
}

/**
 * Curated cross-block snapshot for a single state (the reference dashboard's
 * "state profile"): its composite score, donor/programme footprint, and the eight
 * curated headline indicators with the state's REAL measurement. Out-of-coverage /
 * unmeasured cells are labelled honestly — never fabricated.
 */
export function StateProfileModal({ state, blocks, onClose, onScope }: Props) {
  const byName = useMemo<Record<string, Indicator>>(() => {
    const m: Record<string, Indicator> = {};
    if (blocks) (Object.keys(blocks) as BlockName[]).forEach((bn) => blocks[bn].forEach((i) => (m[i.name] = i)));
    return m;
  }, [blocks]);

  const rows = useMemo<ProfileRow[]>(() => {
    if (!state || !blocks) return [];
    const blockOf = blockOfName(blocks);

    return PROFILE_INDICATOR_NAMES.map((name) => {
      const ind = byName[name];
      if (!ind) return null;
      const m = stateMeasures(name)[state];
      const inCoverage = coverageStates(ind).includes(state);
      const goodness = m ? (ind.inverse ? 100 - m.pct : m.pct) : 0;
      // Functional status packs a long L2/L1/partial/non-func breakdown into `value`;
      // in this compact table just show the headline "% functional".
      const display = m
        ? name === FUNCTIONAL_STATUS_INDICATOR
          ? `${Math.round(m.pct)}% functional`
          : decodeHtml(m.value)
        : '';
      return {
        name,
        block: blockOf[name],
        measure: m ? { display, goodness } : null,
        inCoverage,
      } satisfies ProfileRow;
    }).filter((r): r is ProfileRow => r !== null);
  }, [state, blocks]);

  if (!state) return null;

  // Same uniform composite the map paints this state with, so the two never disagree.
  const score = stateCompositeScore(state, byName);
  const donors = STATE_DONORS[state] ?? [];

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={`${state} — state profile`}
      subtitle="Curated cross-block snapshot. Open any indicator card in its block for the full state-by-state breakdown."
      size="max-w-3xl"
      footer={
        onScope && (
          <div className="flex items-center justify-end">
            <button
              onClick={() => {
                onScope(state);
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-bright"
            >
              Scope dashboard to {state} <ArrowRight size={13} />
            </button>
          </div>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-bg-elev-2 px-4 py-3">
        <div className="text-sm">
          <span className="text-muted">Composite performance: </span>
          <span className="font-bold text-text">{score != null ? `${Math.round(score)}/100` : '—'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted">Donor / programme presence:</span>
          {donors.length ? (
            donors.map((d) => (
              <span key={d} className="rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-semibold text-brand-bright">
                {d}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-bg-elev-3 px-2 py-0.5 text-[11px] font-semibold text-muted">
              No mapped donor
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-elev-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Indicator</th>
              <th className="px-3 py-2 font-semibold">Building block</th>
              <th className="px-3 py-2 font-semibold">Value for {state}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, block, measure, inCoverage }) => (
              <tr key={name} className="border-t border-border-soft align-middle">
                <td className="px-3 py-2.5 font-medium text-text">{cleanName(name)}</td>
                <td className="px-3 py-2.5 text-muted">{block}</td>
                <td className="px-3 py-2.5">
                  {measure ? (
                    <div className="flex items-center gap-3">
                      <span className="w-28 flex-shrink-0 font-semibold" style={{ color: heatColor(measure.goodness) }}>
                        {measure.display}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elev-3">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.max(measure.goodness, 3)}%`, background: heatColor(measure.goodness) }}
                        />
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted">{inCoverage ? 'No data' : 'Not in coverage'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
