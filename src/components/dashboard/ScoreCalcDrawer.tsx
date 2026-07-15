import { Drawer } from '@/components/ui/Drawer';
import { heatColor } from '@/data/calculations';
import {
  BLOCK_NAMES,
  BLOCK_SHORT,
  GRADE_BANDS,
  type ScorecardRow,
} from '@/data/scorecard';
import { cleanName } from '@/lib/format';

/**
 * "How this grade was computed" drawer — the transparency surface for a scorecard
 * row. Shows the overall composite → grade, then each building-block sub-score with
 * the exact indicators (and their inverse-aware 0–100 goodness) that fed its mean.
 * Everything is read straight off the engine's `ScorecardRow.blocks[*].contributors`,
 * so what the drawer shows is literally what produced the grade — no re-derivation.
 */
export function ScoreCalcDrawer({ row, onClose }: { row: ScorecardRow | null; onClose: () => void }) {
  const scopeLabel =
    row == null
      ? ''
      : row.level === 'national'
        ? 'National'
        : row.level === 'lga'
          ? `${row.label}${row.state ? `, ${row.state}` : ''}`
          : row.label;

  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      side="right"
      width={420}
      title="How this grade is calculated"
      subtitle={scopeLabel}
    >
      {row && (
        <div className="space-y-5">
          {/* Overall composite → grade. */}
          <div className="rounded-lg border border-border bg-bg-elev-2 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-2">Overall composite</div>
                <div className="mt-0.5 text-2xl font-extrabold tabular-nums text-text">
                  {row.overall != null ? Math.round(row.overall) : '—'}
                  <span className="text-sm font-bold text-muted">/100</span>
                </div>
              </div>
              {row.grade && row.overall != null && (
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-extrabold text-white shadow-sm"
                  style={{ background: heatColor(row.overall) }}
                >
                  {row.grade}
                </span>
              )}
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
              The overall score is the <strong>mean of the {row.blocksMeasured} building-block sub-score
              {row.blocksMeasured === 1 ? '' : 's'}</strong> that have data for this scope (each block weighs equally),
              then mapped to a letter grade.
            </p>
          </div>

          {/* Per-block breakdown with the contributing indicators. */}
          <div className="space-y-4">
            {BLOCK_NAMES.map((bn) => {
              const b = row.blocks[bn];
              const contributors = [...b.contributors].sort((a, c) => c.goodness - a.goodness);
              return (
                <div key={bn} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between border-b border-border-soft px-3.5 py-2.5">
                    <div className="text-sm font-bold text-text">
                      {BLOCK_SHORT[bn]}
                      <span className="ml-1.5 text-[11px] font-semibold text-muted-2">{bn}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-[11px] text-muted-2">{b.n} ind.</span>
                      <span
                        className="text-base font-extrabold"
                        style={{ color: b.score != null ? heatColor(b.score) : undefined }}
                      >
                        {b.score != null ? Math.round(b.score) : '—'}
                      </span>
                    </div>
                  </div>

                  {contributors.length ? (
                    <ul className="divide-y divide-border-soft">
                      {contributors.map((c) => (
                        <li key={c.name} className="flex items-center gap-3 px-3.5 py-2">
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-soft" title={cleanName(c.name)}>
                            {cleanName(c.name)}
                          </span>
                          <span className="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-bg-elev-3" aria-hidden>
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.max(c.goodness, 3)}%`, background: heatColor(c.goodness) }}
                            />
                          </span>
                          <span
                            className="w-7 flex-shrink-0 text-right text-xs font-bold tabular-nums"
                            style={{ color: heatColor(c.goodness) }}
                          >
                            {Math.round(c.goodness)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-3.5 py-3 text-[12px] italic text-muted">No measured indicator for this scope.</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Method note + grade bands. */}
          <div className="rounded-lg border border-border-soft bg-bg-elev-2/60 px-4 py-3 text-[12px] leading-relaxed text-muted">
            <p>
              Each indicator contributes its <strong>0–100 goodness</strong> — higher is always better, so mortality,
              stock-out and other “lower is better” indicators are inverted first. A block sub-score is the mean across
              its gradeable indicators that have real data; raw counts (“Number of …”) are excluded because their scale
              isn’t a comparable 0–100.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {GRADE_BANDS.map((g) => (
                <span
                  key={g.grade}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elev px-2 py-0.5 font-semibold tabular-nums"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: heatColor(g.min + 5) }} aria-hidden />
                  {g.grade} ≥ {g.min}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
