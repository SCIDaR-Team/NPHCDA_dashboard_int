import { useEffect, useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { ErrorState, Skeleton, GroupedDropdownBar, type DropdownGroup } from '@/components/ui';
import { EChart } from '@/components/charts/EChart';
import { lineOption, type LineParams } from '@/components/charts/chartBase';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useChartTheme } from '@/components/charts/chartTheme';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { trendColors, defaultsOn, TREND_GROUPS } from '@/data/config';
import {
  monthlyToQuarterly,
  monthlyToYearly,
  linregress,
  monthLabels,
  quarterLabels,
  yearLabels,
  scopeLabel,
} from '@/data/calculations';
import { scopedTrends } from '@/data/scopedEngine';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useSnapshotStore } from '@/store/snapshotStore';
import type { TrendSeries } from '@/data/types';

type Gran = 'monthly' | 'quarterly' | 'yearly';
type Mode = 'index' | 'actual';

export function TrendPage() {
  const ds = getDataSource();
  const { data: nationalTrends, loading, error, reload } = useAsync(() => ds.getTrendSeries());
  const filter = useFilterStore(pickFilter);
  const facts = useSnapshotStore((s) => s.facts);
  const theme = useChartTheme();
  const chartRef = useRef<HTMLDivElement>(null);

  // Trends honour the dashboard's geography / facility-type / donor scope (the period
  // filter is ignored — a trend spans time). When a scope is active, recompute the
  // series over the AND-filtered facts via the shared trend engine; else national.
  const geoActive = !!(filter.state || filter.zone || filter.lga || filter.facility || filter.facilityType || filter.donor || filter.source);
  const trendSeries = useMemo<TrendSeries | null>(() => {
    if (geoActive && facts) return scopedTrends(filter);
    return nationalTrends ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoActive, facts, nationalTrends, filter.state, filter.zone, filter.lga, filter.facility, filter.facilityType, filter.donor, filter.source]);
  const scopeChip = geoActive ? scopeLabel({ ...filter, year: '', month: '' }) : '';

  const [gran, setGran] = useState<Gran>('monthly');
  const [mode, setMode] = useState<Mode>('index');
  const [trendlines, setTrendlines] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(defaultsOn));

  const names = trendSeries ? Object.keys(trendSeries) : [];

  // Checkboxes are grouped by measure family (organisational only). The colour index
  // is still taken from a series' position in the FULL list, so a grouped pill keeps
  // the same colour as its line on the chart. Series not listed in TREND_GROUPS fall
  // into an "Other" bucket, so a new snapshot series never vanishes from the picker.
  const groupedNames = (() => {
    const assigned = new Set<string>();
    const groups = TREND_GROUPS.map((g) => {
      const series = g.series.filter((s) => names.includes(s));
      series.forEach((s) => assigned.add(s));
      return { label: g.label, series };
    }).filter((g) => g.series.length);
    const other = names.filter((n) => !assigned.has(n));
    if (other.length) groups.push({ label: 'Other', series: other });
    return groups;
  })();

  // Same groups, shaped for the compact dropdown (each pill keeps its line colour).
  const trendDropdownGroups: DropdownGroup[] = groupedNames.map((g) => ({
    label: g.label,
    items: g.series.map((name) => ({
      key: name,
      label: name,
      color: trendColors[names.indexOf(name) % trendColors.length],
    })),
  }));

  // Whatever the source, make sure a sensible set of series starts selected —
  // the mock defaults won't exist under a live snapshot with different series.
  useEffect(() => {
    if (!names.length) return;
    setChecked((prev) => {
      const stillValid = [...prev].filter((n) => names.includes(n));
      if (stillValid.length) return prev;
      return new Set(names.slice(0, 3));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendSeries]);

  // Series are stored at native MONTHLY resolution. Count series (name carries
  // "(count)") roll up to quarter/year by SUM; rate/percent series by MEAN.
  const aggFor = (name: string): 'sum' | 'mean' => (/\(count\)/i.test(name) ? 'sum' : 'mean');
  const seriesFor = (raw: (number | null)[], name: string) => {
    if (gran === 'quarterly') return monthlyToQuarterly(raw, aggFor(name));
    if (gran === 'yearly') return monthlyToYearly(raw, aggFor(name));
    return raw.slice();
  };
  const labels = gran === 'monthly' ? monthLabels : gran === 'yearly' ? yearLabels : quarterLabels;

  // Trim leading periods where every active series is empty, so a live snapshot
  // that only covers recent months doesn't render a mostly-blank axis.
  const trimStart = (rows: (number | null)[][]): number => {
    const len = labels.length;
    for (let i = 0; i < len; i++) {
      if (rows.some((r) => typeof r[i] === 'number' && isFinite(r[i] as number))) return i;
    }
    return 0;
  };

  const option = useMemo<EChartsOption | null>(() => {
    if (!trendSeries) return null;
    const ts: TrendSeries = trendSeries;
    const active = names.filter((n) => checked.has(n));
    const series: LineParams['series'] = [];

    const rawByName = active.map((name) => seriesFor(ts[name], name));
    const start = trimStart(rawByName);
    const categories = labels.slice(start);

    active.forEach((name, ai) => {
      const colorIdx = Object.keys(ts).indexOf(name);
      const color = trendColors[colorIdx % trendColors.length];
      const raw = rawByName[ai].slice(start);
      const base = raw.find((v) => typeof v === 'number' && isFinite(v) && v !== 0) ?? null;
      const data =
        mode === 'index'
          ? raw.map((v) => (typeof v === 'number' && base ? +((v / base) * 100).toFixed(1) : null))
          : raw;
      series.push({ name, data, color });
      if (trendlines) {
        series.push({ name: `${name} (trend)`, data: linregress(data), color, dashed: true, silent: true });
      }
    });

    return lineOption({
      theme,
      categories,
      series,
      smooth: gran !== 'monthly',
      showSymbol: gran !== 'monthly',
      yName: mode === 'index' ? 'Indexed (=100 at start)' : 'Actual',
      legendData: active,
      xInterval: gran === 'monthly' ? 2 : 0,
    });
  }, [trendSeries, checked, gran, mode, trendlines, theme]);

  const exportRows = useMemo(() => {
    if (!trendSeries) return [];
    const active = names.filter((n) => checked.has(n));
    const rawByName = active.map((n) => seriesFor(trendSeries[n], n));
    const start = trimStart(rawByName);
    return labels.slice(start).map((label, i) => {
      const row: Record<string, unknown> = { Period: label };
      active.forEach((n, ai) => {
        const raw = rawByName[ai].slice(start);
        const base = raw.find((v) => typeof v === 'number' && isFinite(v) && v !== 0) ?? null;
        const vi = raw[i];
        row[n] =
          mode === 'index'
            ? typeof vi === 'number' && base
              ? +((vi / base) * 100).toFixed(1)
              : null
            : vi;
      });
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendSeries, checked, gran, mode]);

  const toggle = (name: string) =>
    setChecked((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    // Fixed-height page: header + controls + chart fill the viewport so the chart
    // flexes to the available space and the page never needs to scroll.
    <div className="flex h-[calc(100dvh-7rem)] min-h-[460px] flex-col">
      <PageHeader
        title="Trend Analysis"
        subtitle="Compare indicators month-by-month, or rolled up to quarters or years. Indexed mode lets indicators with different units share one axis."
        actions={<ExportMenu filename="nphcda-trends" rows={exportRows} captureRef={chartRef} />}
      />

      {/* Not a SectionBlock: this card must NOT clip its children so the group
          dropdowns can overflow it. It flexes to fill the remaining height. */}
      <div className="flex min-h-0 flex-1 flex-col rounded-card border border-border bg-bg-elev shadow-card">
        <div className="flex items-center gap-2.5 border-b border-border-soft px-5 py-3.5">
          <span className="h-[18px] w-1 flex-shrink-0 rounded-sm bg-brand" />
          <h2 className="text-[14.5px] font-bold text-text">Compare indicators over time</h2>
        </div>

        {loading ? (
          <div className="flex-1 p-5">
            <Skeleton className="h-full" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-2">
                Indicators ({checked.size} of {names.length})
              </span>
              <GroupedDropdownBar
                groups={trendDropdownGroups}
                isChecked={(k) => checked.has(k)}
                onToggle={toggle}
                panelWidth="w-80"
              />
              {scopeChip && (
                <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-bright">
                  Scoped · {scopeChip}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Segmented value={gran} onChange={(v) => setGran(v as Gran)} options={[
                ['monthly', 'Monthly'],
                ['quarterly', 'Quarterly'],
                ['yearly', 'Yearly'],
              ]} />
              <Segmented value={mode} onChange={(v) => setMode(v as Mode)} options={[
                ['index', 'Indexed (=100)'],
                ['actual', 'Actual values'],
              ]} />
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-text-soft">
                <input type="checkbox" checked={trendlines} onChange={(e) => setTrendlines(e.target.checked)} className="h-3.5 w-3.5 accent-brand" />
                Show linear trendlines
              </label>
            </div>

            <div ref={chartRef} className="min-h-0 flex-1">{option && <EChart option={option} height="100%" />}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div role="group" className="inline-flex rounded-lg border border-border bg-bg-elev-2 p-0.5">
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          aria-pressed={value === val}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand/60 ${
            value === val ? 'bg-brand text-white' : 'text-muted hover:text-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
