import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton, Card } from '@/components/ui';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ALL_STATES, ZONE_OF_STATE } from '@/data/geo/states';
import { lgasForState, heatColor } from '@/data/calculations';
import { gradeableByBlock, BLOCK_NAMES, type Grade } from '@/data/scorecard';
import { leagueRows, type LeagueLevel, type LeagueMetric, type LeagueRow } from '@/data/league';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Indicator } from '@/data/types';

const STATES_ALPHA = [...ALL_STATES].sort((a, b) => a.localeCompare(b));

export function LeagueTablesPage() {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const filter = useFilterStore(pickFilter);
  const setFilter = useFilterStore((s) => s.set);
  const toast = useNotificationStore((s) => s.toast);

  const [level, setLevel] = useState<LeagueLevel>('state');
  const [metric, setMetric] = useState<LeagueMetric>('composite');
  const [scopeState, setScopeState] = useState<string>(filter.state || STATES_ALPHA[0]);
  const [worstFirst, setWorstFirst] = useState(false);

  const indByName = useMemo(() => {
    const m: Record<string, Indicator> = {};
    if (blocks) Object.values(blocks).forEach((list) => list.forEach((i) => (m[i.name] = i)));
    return m;
  }, [blocks]);

  // Composite has no facility grain — fall back to a sensible indicator there.
  const effectiveMetric: LeagueMetric =
    level === 'facility' && metric === 'composite'
      ? 'Proportion of PHCs with all six tracer commodities available*'
      : metric;

  const rows = useMemo<LeagueRow[]>(() => {
    if (!blocks) return [];
    const keys = level === 'lga' ? lgasForState(scopeState).map((l) => `${scopeState}|${l}`) : ALL_STATES;
    const built = leagueRows(blocks, level, effectiveMetric, {
      indByName,
      state: level === 'state' ? undefined : scopeState,
      keys,
    });
    return worstFirst ? [...built].reverse() : built;
  }, [blocks, level, effectiveMetric, scopeState, indByName, worstFirst]);

  const activeInd = effectiveMetric === 'composite' ? null : indByName[effectiveMetric];
  const isComposite = effectiveMetric === 'composite';

  const scopeTo = (r: LeagueRow) => {
    if (level === 'facility' && r.state) {
      setFilter({ state: r.state, zone: ZONE_OF_STATE[r.state], lga: r.lga ?? '', facility: r.label, ward: '' });
    } else if (level === 'lga' && r.state) {
      setFilter({ state: r.state, zone: ZONE_OF_STATE[r.state], lga: r.label, ward: '', facility: '' });
    } else {
      setFilter({ state: r.label, zone: ZONE_OF_STATE[r.label], lga: '', ward: '', facility: '' });
    }
    toast({ tone: 'info', title: `Scoped to ${r.label}`, description: 'All pages now reflect this selection.' });
  };

  const exportRows = useMemo(
    () =>
      rows.map((r, i) => ({
        Rank: i + 1,
        Scope: level === 'state' ? r.label : `${r.state} — ${r.label}`,
        [isComposite ? 'Composite' : 'Value']: r.display,
        ...(isComposite ? { Grade: r.grade ?? '' } : {}),
        ...(r.movement ? { 'YoY change': `${r.movement.delta > 0 ? '+' : ''}${r.movement.delta} pts (${r.movement.fromYear}→${r.movement.toYear})` } : {}),
      })),
    [rows, level, isComposite]
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;

  const levelLabel = level === 'state' ? 'State' : level === 'lga' ? 'LGA' : 'Facility';

  return (
    <div>
      <PageHeader
        title="League tables"
        subtitle="Rank states, LGAs or facilities by overall composite or any single indicator — best to worst, with year-over-year movement where periodic data exists."
        actions={<ExportMenu filename={`nphcda-league-${level}-${isComposite ? 'composite' : 'indicator'}`} rows={exportRows} />}
      />

      <div data-tour="league">
      <SectionBlock
        title="Ranking"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={[
                { value: 'state', label: 'States' },
                { value: 'lga', label: 'LGAs' },
                { value: 'facility', label: 'Facilities' },
              ]}
              value={level}
              onChange={(v) => setLevel(v as LeagueLevel)}
            />
            {level !== 'state' && (
              <select
                value={scopeState}
                onChange={(e) => setScopeState(e.target.value)}
                aria-label="State to rank within"
                className="h-9 rounded-lg border border-border bg-bg-elev px-2.5 text-sm font-semibold text-text focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                {STATES_ALPHA.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              aria-label="Metric to rank by"
              className="h-9 max-w-[280px] rounded-lg border border-border bg-bg-elev px-2.5 text-sm font-semibold text-text focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {level !== 'facility' && <option value="composite">Composite performance</option>}
              {blocks &&
                BLOCK_NAMES.map((bn) => (
                  <optgroup key={bn} label={bn}>
                    {gradeableByBlock(blocks)[bn].map((ind) => (
                      <option key={ind.name} value={ind.name}>
                        {cleanName(ind.name)}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            <button
              onClick={() => setWorstFirst((w) => !w)}
              aria-pressed={worstFirst}
              className="h-9 rounded-lg border border-border px-3 text-sm font-semibold text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {worstFirst ? 'Worst first' : 'Best first'}
            </button>
          </div>
        }
      >
        <p className="mb-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-muted-2" />
          <span>
            {isComposite
              ? `Ranked by overall composite (0–100). Grades: A ≥ 80 · B ≥ 67 · C ≥ 50 · D ≥ 34 · F < 34.`
              : activeInd?.inverse
                ? 'This is a “lower is better” indicator — the ranking already inverts it, so the top row is the strongest performer. Movement in green means the value fell (improved).'
                : 'Ranked by the indicator’s per-scope value. Movement in green means it rose (improved) year-over-year.'}
            {' '}Click a {levelLabel.toLowerCase()} to scope every page to it.
          </span>
        </p>

        {loading ? (
          <Skeleton className="h-80 rounded-card" />
        ) : !rows.length ? (
          <Card className="px-4 py-8 text-center text-sm text-muted">
            No {levelLabel.toLowerCase()} has a measurement for this metric{level !== 'state' ? ` in ${scopeState}` : ''}.
          </Card>
        ) : (
          <div className="max-h-[640px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {isComposite ? 'Composite' : cleanName(effectiveMetric)} league by {levelLabel}
              </caption>
              <thead className="sticky top-0 z-10 bg-bg-elev-2 text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">#</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">{levelLabel}</th>
                  {level !== 'state' && <th scope="col" className="px-3 py-2.5 font-semibold">State</th>}
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    {isComposite ? 'Composite' : 'Value'}
                  </th>
                  {!isComposite && level !== 'facility' && (
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">YoY</th>
                  )}
                  {isComposite && <th scope="col" className="px-3 py-2.5 text-center font-semibold">Grade</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} className="border-t border-border-soft hover:bg-bg-elev-2/50">
                    <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      {level === 'facility' ? (
                        <Link
                          to={`/app/facility/${encodeURIComponent(r.key)}`}
                          className="font-medium text-text hover:text-brand-bright hover:underline focus-visible:ring-2 focus-visible:ring-brand/60"
                        >
                          {r.label}
                        </Link>
                      ) : (
                        <button
                          onClick={() => scopeTo(r)}
                          className="text-left font-medium text-text hover:text-brand-bright focus-visible:ring-2 focus-visible:ring-brand/60"
                        >
                          {r.label}
                        </button>
                      )}
                    </td>
                    {level !== 'state' && <td className="px-3 py-2 text-muted">{r.state}</td>}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-bg-elev-3 sm:block" aria-hidden>
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(r.goodness, 3)}%`, background: heatColor(r.goodness) }} />
                        </span>
                        <span className="min-w-[54px] text-right font-semibold tabular-nums text-text-soft">{r.display}</span>
                      </div>
                    </td>
                    {!isComposite && level !== 'facility' && (
                      <td className="px-3 py-2 text-right">
                        <MovementCell movement={r.movement} />
                      </td>
                    )}
                    {isComposite && (
                      <td className="px-3 py-2 text-center">
                        <GradePill grade={r.grade ?? null} score={r.goodness} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>
      </div>
    </div>
  );
}

function MovementCell({ movement }: { movement: LeagueRow['movement'] }) {
  if (!movement) return <span className="text-xs italic text-muted-2">—</span>;
  const { delta, improved, fromYear, toYear } = movement;
  const flat = delta === 0;
  const color = flat ? 'var(--muted)' : improved ? '#2e8b57' : '#c2562c';
  const Icon = flat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className="inline-flex items-center gap-1 font-semibold tabular-nums"
      style={{ color: flat ? undefined : color }}
      title={`${fromYear} → ${toYear}`}
    >
      <Icon size={13} />
      {delta > 0 ? '+' : ''}
      {delta} pts
    </span>
  );
}

function GradePill({ grade, score }: { grade: Grade | null; score: number }) {
  if (!grade) return <span className="text-muted-2">—</span>;
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
