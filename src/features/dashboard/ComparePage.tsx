import { useMemo, useState } from 'react';
import { X, Plus, Info } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton, Card } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { ALL_STATES } from '@/data/geo/states';
import { goodnessFor, heatColor } from '@/data/calculations';
import { stateMeasures } from '@/data/scopedEngine';
import {
  gradeableByBlock,
  nationalScorecardRow,
  scorecardRows,
  BLOCK_NAMES,
  BLOCK_SHORT,
  type ScorecardRow,
  type Grade,
} from '@/data/scorecard';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { BlockName, Indicator } from '@/data/types';

const STATES_ALPHA = [...ALL_STATES].sort((a, b) => a.localeCompare(b));
const MAX_SCOPES = 4;

/** A scope column: 'National' or a state name. */
type Scope = string;

export function ComparePage() {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const [scopes, setScopes] = useState<Scope[]>(['National', STATES_ALPHA[0]]);

  // Scorecard row per scope (composite + block sub-scores + grade).
  const cardByScope = useMemo<Record<Scope, ScorecardRow | null>>(() => {
    const out: Record<Scope, ScorecardRow | null> = {};
    if (!blocks) return out;
    const stateScopes = scopes.filter((s) => s !== 'National');
    const rows = stateScopes.length ? scorecardRows(blocks, 'state', stateScopes) : [];
    const byState = new Map(rows.map((r) => [r.key, r]));
    for (const s of scopes) out[s] = s === 'National' ? nationalScorecardRow(blocks) : byState.get(s) ?? null;
    return out;
  }, [blocks, scopes]);

  // Per-indicator goodness for each scope (National uses the indicator's own pct).
  const goodnessFor2 = (ind: Indicator, scope: Scope): number | null => {
    if (scope === 'National') return ind.pct > 0 ? goodnessFor({ inverse: ind.inverse, pct: ind.pct }) : null;
    const m = stateMeasures(ind.name)[scope];
    return m ? goodnessFor({ inverse: ind.inverse, pct: m.pct }) : null;
  };

  const addScope = (s: Scope) => setScopes((cur) => (cur.includes(s) || cur.length >= MAX_SCOPES ? cur : [...cur, s]));
  const removeScope = (s: Scope) => setScopes((cur) => cur.filter((x) => x !== s));

  const available = ['National', ...STATES_ALPHA].filter((s) => !scopes.includes(s));

  const exportRows = useMemo(() => {
    if (!blocks) return [];
    const rows: Record<string, unknown>[] = [];
    for (const bn of BLOCK_NAMES) {
      for (const ind of gradeableByBlock(blocks)[bn]) {
        const row: Record<string, unknown> = { Block: BLOCK_SHORT[bn], Indicator: cleanName(ind.name) };
        for (const s of scopes) {
          const g = goodnessFor2(ind, s);
          row[s] = g == null ? '' : Math.round(g);
        }
        rows.push(row);
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, scopes]);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Compare scopes"
        subtitle="Put up to four scopes side by side — National or any states — across their composite grade, building-block sub-scores and every indicator."
        actions={<ExportMenu filename="nphcda-compare" rows={exportRows} />}
      />

      {/* Scope chips + add control. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {scopes.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elev px-3 py-1.5 text-sm font-semibold text-text shadow-card">
            {s}
            {scopes.length > 1 && (
              <button onClick={() => removeScope(s)} aria-label={`Remove ${s}`} className="text-muted transition-colors hover:text-danger">
                <X size={13} />
              </button>
            )}
          </span>
        ))}
        {scopes.length < MAX_SCOPES && available.length > 0 && (
          <label className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-semibold text-muted">
            <Plus size={14} />
            <select
              value=""
              onChange={(e) => e.target.value && addScope(e.target.value)}
              aria-label="Add a scope to compare"
              className="bg-transparent text-sm font-semibold text-text focus:outline-none"
            >
              <option value="">Add scope…</option>
              {available.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Small multiples: one card per scope with its composite grade + block bars. */}
      <div className={cn('mb-5 grid gap-4', gridColsFor(scopes.length))}>
        {loading
          ? scopes.map((s) => <Skeleton key={s} className="h-44 rounded-card" />)
          : scopes.map((s) => <ScopeCard key={s} scope={s} row={cardByScope[s] ?? null} />)}
      </div>

      {/* Side-by-side indicator comparison. */}
      <SectionBlock title="Indicator comparison">
        <p className="mb-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-muted-2" />
          <span>
            Each cell is the scope's 0–100 performance (inverse-aware) for the indicator, coloured on the shared heat
            scale. The strongest scope in each row is marked.
          </span>
        </p>
        {loading || !blocks ? (
          <Skeleton className="h-80 rounded-card" />
        ) : (
          <div className="max-h-[640px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-bg-elev-2 text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Indicator</th>
                  {scopes.map((s) => (
                    <th key={s} scope="col" className="px-3 py-2.5 text-right font-semibold">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BLOCK_NAMES.map((bn) => (
                  <BlockRows key={bn} block={bn} inds={gradeableByBlock(blocks)[bn]} scopes={scopes} goodnessOf={goodnessFor2} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>
    </div>
  );
}

function gridColsFor(n: number): string {
  return n <= 1 ? 'sm:grid-cols-1' : n === 2 ? 'sm:grid-cols-2' : n === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
}

function ScopeCard({ scope, row }: { scope: Scope; row: ScorecardRow | null }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-text">{scope}</span>
        <GradeBadge grade={row?.grade ?? null} score={row?.overall ?? null} />
      </div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums text-text">
        {row?.overall != null ? Math.round(row.overall) : '—'}
        <span className="text-sm font-bold text-muted">/100</span>
      </div>
      <div className="mt-3 space-y-2">
        {BLOCK_NAMES.map((bn) => {
          const s = row?.blocks[bn].score ?? null;
          return (
            <div key={bn} className="flex items-center gap-2">
              <span className="w-16 flex-shrink-0 text-[11px] font-semibold text-muted">{BLOCK_SHORT[bn]}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elev-3">
                {s != null && <span className="block h-full rounded-full" style={{ width: `${Math.max(s, 3)}%`, background: heatColor(s) }} />}
              </span>
              <span className="w-7 text-right text-[12px] font-bold tabular-nums" style={s != null ? { color: heatColor(s) } : undefined}>
                {s != null ? Math.round(s) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BlockRows({
  block,
  inds,
  scopes,
  goodnessOf,
}: {
  block: BlockName;
  inds: Indicator[];
  scopes: Scope[];
  goodnessOf: (ind: Indicator, scope: Scope) => number | null;
}) {
  return (
    <>
      <tr className="bg-bg-elev-3/50">
        <td colSpan={scopes.length + 1} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-bright">
          {BLOCK_SHORT[block]}
        </td>
      </tr>
      {inds.map((ind) => {
        const vals = scopes.map((s) => goodnessOf(ind, s));
        const measured = vals.filter((v): v is number => v != null);
        const best = measured.length > 1 ? Math.max(...measured) : null;
        return (
          <tr key={ind.name} className="border-t border-border-soft hover:bg-bg-elev-2/50">
            <td className="px-3 py-2 font-medium text-text">{cleanName(ind.name)}</td>
            {vals.map((v, i) => (
              <td key={scopes[i]} className="px-3 py-2 text-right">
                {v == null ? (
                  <span className="text-xs italic text-muted-2">—</span>
                ) : (
                  <span
                    className={cn('inline-flex items-center gap-1.5 font-semibold tabular-nums', best != null && v === best && 'font-extrabold')}
                    style={{ color: heatColor(v) }}
                  >
                    {best != null && v === best && <span className="h-1.5 w-1.5 rounded-full" style={{ background: heatColor(v) }} aria-hidden />}
                    {Math.round(v)}
                  </span>
                )}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

function GradeBadge({ grade, score }: { grade: Grade | null; score: number | null }) {
  if (!grade || score == null) return <span className="text-muted-2">—</span>;
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-white shadow-sm"
      style={{ background: heatColor(score) }}
      title={`Grade ${grade} · ${Math.round(score)}/100`}
    >
      {grade}
    </span>
  );
}
