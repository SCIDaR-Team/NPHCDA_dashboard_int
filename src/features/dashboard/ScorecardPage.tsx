import { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton, Card } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { ScoreCalcDrawer } from '@/components/dashboard/ScoreCalcDrawer';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ALL_STATES, ZONE_OF_STATE } from '@/data/geo/states';
import { lgasForState, heatColor } from '@/data/calculations';
import {
  BLOCK_NAMES,
  BLOCK_SHORT,
  nationalScorecardRow,
  scorecardRows,
  type ScorecardRow,
  type Grade,
} from '@/data/scorecard';
import { cn } from '@/lib/cn';
import type { BlockName } from '@/data/types';

type Level = 'state' | 'lga';
type SortKey = 'label' | BlockName | 'overall';

/** States A→Z (ALL_STATES is ordered geographically) — for the LGA state picker. */
const STATES_ALPHA = [...ALL_STATES].sort((a, b) => a.localeCompare(b));

/** A letter grade in a pill, coloured on the shared heat scale (respects the
 *  colour-blind-safe toggle). When `onClick` is given it becomes a button that opens
 *  the calculation drawer. Renders a muted dash when the scope has no data. */
function GradeBadge({
  grade,
  score,
  size = 'md',
  onClick,
}: {
  grade: Grade | null;
  score: number | null;
  size?: 'md' | 'lg';
  onClick?: () => void;
}) {
  if (!grade || score == null) {
    return <span className="inline-block text-muted-2">—</span>;
  }
  const cls = cn(
    'inline-flex items-center justify-center rounded-lg font-extrabold text-white shadow-sm tabular-nums',
    size === 'lg' ? 'h-11 w-11 text-2xl' : 'h-7 w-7 text-sm',
    onClick && 'transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
  );
  const style = { background: heatColor(score) };
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cls}
        style={style}
        aria-label={`Grade ${grade}, ${Math.round(score)} of 100 — show how it was calculated`}
        title={`Grade ${grade} · ${Math.round(score)}/100 — how it's calculated`}
      >
        {grade}
      </button>
    );
  }
  return (
    <span className={cls} style={style} title={`Grade ${grade} · ${Math.round(score)}/100`}>
      {grade}
    </span>
  );
}

/** A 0–100 sub-score as a coloured chip + micro-bar, or a muted dash when null. */
function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs italic text-muted-2">—</span>;
  const color = heatColor(score);
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-bg-elev-3 sm:block" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(score, 3)}%`, background: color }} />
      </span>
      <span className="w-7 text-right font-semibold tabular-nums" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export function ScorecardPage() {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const filter = useFilterStore(pickFilter);
  const setFilter = useFilterStore((s) => s.set);
  const toast = useNotificationStore((s) => s.toast);

  const [level, setLevel] = useState<Level>('state');
  // For the LGA view, which state's LGAs to grade (defaults to the active scope).
  const [lgaState, setLgaState] = useState<string>(filter.state || STATES_ALPHA[0]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'overall', dir: 'desc' });
  // The row whose grade-calculation drawer is open (null = closed).
  const [calcRow, setCalcRow] = useState<ScorecardRow | null>(null);

  const national = useMemo(() => (blocks ? nationalScorecardRow(blocks) : null), [blocks]);

  // The scope rows (states, or the chosen state's LGAs). LGA rows with no data at all
  // are dropped so the table isn't padded with empty administrative units.
  const rows = useMemo<ScorecardRow[]>(() => {
    if (!blocks) return [];
    if (level === 'state') return scorecardRows(blocks, 'state', ALL_STATES);
    const keys = lgasForState(lgaState).map((lga) => `${lgaState}|${lga}`);
    return scorecardRows(blocks, 'lga', keys).filter((r) => r.blocksMeasured > 0);
  }, [blocks, level, lgaState]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const valueOf = (r: ScorecardRow): number | null =>
      sort.key === 'label' ? null : sort.key === 'overall' ? r.overall : r.blocks[sort.key].score;
    return [...rows].sort((a, b) => {
      if (sort.key === 'label') return a.label.localeCompare(b.label) * dir;
      const av = valueOf(a);
      const bv = valueOf(b);
      // Unmeasured scopes always sort to the bottom, regardless of direction.
      if (av == null && bv == null) return a.label.localeCompare(b.label);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir || a.label.localeCompare(b.label);
    });
  }, [rows, sort]);

  const scopeToState = (state: string) => {
    setFilter({ state, zone: ZONE_OF_STATE[state], lga: '', ward: '', facility: '' });
    toast({ tone: 'info', title: `Scoped to ${state}`, description: 'All pages now reflect this state.' });
  };
  const scopeToLga = (state: string, lga: string) => {
    setFilter({ state, zone: ZONE_OF_STATE[state], lga, ward: '', facility: '' });
    toast({ tone: 'info', title: `Scoped to ${lga}`, description: `${lga}, ${state} is now the active scope.` });
  };

  const exportRows = useMemo(
    () =>
      sorted.map((r) => ({
        Scope: level === 'lga' ? `${r.state} — ${r.label}` : r.label,
        Readiness: r.blocks['Facility Readiness'].score ?? '',
        Stock: r.blocks['Stock Status'].score ?? '',
        Service: r.blocks['Service Delivery'].score ?? '',
        Overall: r.overall ?? '',
        Grade: r.grade ?? '',
      })),
    [sorted, level]
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'label' ? 'asc' : 'desc' }
    );

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Scorecard"
        subtitle="Traffic-light performance matrix — each scope graded A–F on an overall composite and on its three building-block sub-scores (Readiness, Stock, Service). Scores are the mean 0–100 performance of the gradeable indicators with real data for that scope."
        actions={
          <ExportMenu filename={`nphcda-scorecard-${level}`} rows={exportRows} />
        }
      />

      {/* National summary band — the country grade + block sub-scores at a glance. */}
      <SectionBlock title="National grade">
        {loading || !national ? (
          <Skeleton className="h-24 rounded-card" />
        ) : (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <GradeBadge
                grade={national.grade}
                score={national.overall}
                size="lg"
                onClick={() => setCalcRow(national)}
              />
              <div>
                <div className="text-2xl font-extrabold leading-none tabular-nums text-text">
                  {national.overall != null ? `${Math.round(national.overall)}` : '—'}
                  <span className="text-base font-bold text-muted">/100</span>
                </div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">Overall composite</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {BLOCK_NAMES.map((bn) => {
                const s = national.blocks[bn].score;
                return (
                  <div key={bn}>
                    <div
                      className={cn('text-lg font-extrabold tabular-nums', s == null && 'text-muted-2')}
                      style={s == null ? undefined : { color: heatColor(s) }}
                    >
                      {s != null ? Math.round(s) : '—'}
                    </div>
                    <div className="text-[12px] font-semibold text-muted">
                      {BLOCK_SHORT[bn]}
                      <span className="ml-1 text-muted-2">· {national.blocks[bn].n} ind.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        title="Performance matrix"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={[
                { value: 'state', label: 'By state' },
                { value: 'lga', label: 'By LGA' },
              ]}
              value={level}
              onChange={(v) => setLevel(v as Level)}
            />
            {level === 'lga' && (
              <select
                value={lgaState}
                onChange={(e) => setLgaState(e.target.value)}
                aria-label="Choose a state to grade its LGAs"
                className="h-9 rounded-lg border border-border bg-bg-elev px-2.5 text-sm font-semibold text-text focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                {STATES_ALPHA.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      >
        <p className="mb-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-muted-2" />
          <span>
            Cells are coloured on the shared heat scale (green = strong, amber = fair, red = weak; grey = no data for that
            scope). Click a {level === 'lga' ? 'LGA' : 'state'} to scope every page to it.
          </span>
        </p>

        {loading ? (
          <Skeleton className="h-80 rounded-card" />
        ) : !sorted.length ? (
          <Card className="px-4 py-8 text-center text-sm text-muted">
            {level === 'lga'
              ? `No LGA in ${lgaState} has a measurement yet.`
              : 'No states have a measurement yet.'}
          </Card>
        ) : (
          <div className="max-h-[640px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Scorecard by {level === 'lga' ? `LGA in ${lgaState}` : 'state'} — sortable
              </caption>
              <thead className="sticky top-0 z-10 bg-bg-elev-2 text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    #
                  </th>
                  <SortTh label={level === 'lga' ? 'LGA' : 'State'} k="label" sort={sort} onSort={toggleSort} />
                  {BLOCK_NAMES.map((bn) => (
                    <SortTh key={bn} label={BLOCK_SHORT[bn]} k={bn} sort={sort} onSort={toggleSort} align="right" />
                  ))}
                  <SortTh label="Overall" k="overall" sort={sort} onSort={toggleSort} align="right" />
                  <th scope="col" className="px-3 py-2.5 text-center font-semibold">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.key} className="border-t border-border-soft hover:bg-bg-elev-2/50">
                    <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => (r.state ? scopeToLga(r.state, r.label) : scopeToState(r.label))}
                        className="text-left font-medium text-text hover:text-brand-bright focus-visible:ring-2 focus-visible:ring-brand/60"
                      >
                        {r.label}
                      </button>
                    </td>
                    {BLOCK_NAMES.map((bn) => (
                      <td key={bn} className="px-3 py-2">
                        <ScoreCell score={r.blocks[bn].score} />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <ScoreCell score={r.overall} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <GradeBadge grade={r.grade} score={r.overall} onClick={() => setCalcRow(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>

      <ScoreCalcDrawer row={calcRow} onClose={() => setCalcRow(null)} />
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-bg-elev p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand/60',
            value === o.value ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-text'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2.5 font-semibold', align === 'right' && 'text-right')}
    >
      <button
        onClick={() => onSort(k)}
        aria-label={`Sort by ${label}`}
        className={cn(
          'inline-flex items-center gap-1 rounded hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );
}
