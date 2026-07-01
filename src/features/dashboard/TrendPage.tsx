import { useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton } from '@/components/ui';
import { EChart } from '@/components/charts/EChart';
import { lineOption, type LineParams } from '@/components/charts/chartBase';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useChartTheme } from '@/components/charts/chartTheme';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { trendColors, defaultsOn } from '@/data/mock/trends';
import {
  quarterlyToMonthly,
  quarterlyToYearly,
  linregress,
  monthLabels,
  quarterLabels,
  yearLabels,
} from '@/data/calculations';
import type { TrendSeries } from '@/data/types';

type Gran = 'monthly' | 'quarterly' | 'yearly';
type Mode = 'index' | 'actual';

export function TrendPage() {
  const ds = getDataSource();
  const { data: trendSeries, loading, error, reload } = useAsync(() => ds.getTrendSeries());
  const theme = useChartTheme();
  const chartRef = useRef<HTMLDivElement>(null);

  const [gran, setGran] = useState<Gran>('quarterly');
  const [mode, setMode] = useState<Mode>('index');
  const [trendlines, setTrendlines] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(defaultsOn));

  const names = trendSeries ? Object.keys(trendSeries) : [];

  const seriesFor = (raw: number[], name: string) => {
    if (gran === 'monthly') return quarterlyToMonthly(raw, name);
    if (gran === 'yearly') return quarterlyToYearly(raw);
    return raw.slice();
  };
  const labels = gran === 'monthly' ? monthLabels : gran === 'yearly' ? yearLabels : quarterLabels;

  const option = useMemo<EChartsOption | null>(() => {
    if (!trendSeries) return null;
    const ts: TrendSeries = trendSeries;
    const active = names.filter((n) => checked.has(n));
    const series: LineParams['series'] = [];

    active.forEach((name) => {
      const colorIdx = Object.keys(ts).indexOf(name);
      const color = trendColors[colorIdx % trendColors.length];
      const raw = seriesFor(ts[name], name);
      const data = mode === 'index' ? raw.map((v) => +((v / raw[0]) * 100).toFixed(1)) : raw;
      series.push({ name, data, color });
      if (trendlines) {
        series.push({ name: `${name} (trend)`, data: linregress(data), color, dashed: true, silent: true });
      }
    });

    return lineOption({
      theme,
      categories: labels,
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
    return labels.map((label, i) => {
      const row: Record<string, unknown> = { Period: label };
      active.forEach((n) => {
        const raw = seriesFor(trendSeries[n], n);
        row[n] = mode === 'index' ? +((raw[i] / raw[0]) * 100).toFixed(1) : raw[i];
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
    <div>
      <PageHeader
        title="Trend Analysis"
        subtitle="2023 – 2026, monthly / quarterly / yearly. Indexed mode lets indicators with different units share one axis."
        actions={<ExportMenu filename="nphcda-trends" rows={exportRows} captureRef={chartRef} />}
      />

      <SectionBlock title="Compare indicators over time">
        {loading ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
              {names.map((name) => {
                const idx = names.indexOf(name);
                return (
                  <label key={name} className="flex cursor-pointer items-center gap-1.5 text-xs text-text-soft">
                    <input
                      type="checkbox"
                      checked={checked.has(name)}
                      onChange={() => toggle(name)}
                      className="h-3.5 w-3.5 accent-brand"
                    />
                    <span className="h-2 w-2 rounded-full" style={{ background: trendColors[idx % trendColors.length] }} />
                    {name}
                  </label>
                );
              })}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
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

            <div ref={chartRef}>{option && <EChart option={option} height={400} />}</div>
          </>
        )}
      </SectionBlock>
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
    <div className="inline-flex rounded-lg border border-border bg-bg-elev-2 p-0.5">
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === val ? 'bg-brand text-white' : 'text-muted hover:text-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
