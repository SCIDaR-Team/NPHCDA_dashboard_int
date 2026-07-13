import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from '../EChart';
import { useChartTheme } from '../chartTheme';
import { baseTooltip, CHART_FONT, CHART_TYPE, wrapByWords } from '../chartBase';
import { CHART_GREEN } from '../palette';
import { heatColor } from '@/data/calculations';

/**
 * ECharts-based mini-visualizations for indicator cards (donut, gauge, ranked
 * state bars, state dot plot, trend area). Built on the shared chartBase
 * tooltip/typography so the visual language matches the deep-dive charts.
 * Each supports a `ghost` mode (muted shape, no numbers) for pending indicators.
 */

const GHOST = 'rgba(128,138,150,0.28)';
const GHOST_SOFT = 'rgba(128,138,150,0.14)';

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
  /** De-emphasise this slice (context slices in the cause-share donuts). */
  dim?: boolean;
}

/* ------------------------------------------------------------------ *
 * Donut: binary or few-part part-to-whole with a centre headline.
 * ------------------------------------------------------------------ */
export function MiniDonut({
  segments,
  centerText,
  ghost,
  height = 184,
}: {
  segments: DonutSegment[];
  centerText?: string;
  /** Deprecated: the segment legend already names the metric, so no sub-caption is
   *  rendered — kept in the type only so existing call sites still type-check. */
  centerSub?: string;
  ghost?: boolean;
  height?: number;
}) {
  const theme = useChartTheme();
  const option = useMemo<EChartsOption>(() => {
    const data = ghost
      ? [
          { name: '', value: 62, itemStyle: { color: GHOST } },
          { name: '', value: 38, itemStyle: { color: GHOST_SOFT } },
        ]
      : segments
          .filter((s) => s.value > 0)
          .map((s) => ({
            name: s.name,
            value: s.value,
            itemStyle: { color: s.color, opacity: s.dim ? 0.35 : 1 },
          }));
    return {
      tooltip: ghost
        ? { show: false }
        : { ...baseTooltip(theme), formatter: (p: any) => `<b>${p.name}</b><br/>${p.value}%` },
      series: [
        {
          type: 'pie',
          radius: ['60%', '90%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          silent: ghost,
          emphasis: ghost ? undefined : { scaleSize: 3 },
          data,
        },
      ],
      graphic: centerText
        ? [
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: {
                text: centerText,
                fill: ghost ? GHOST : theme.text,
                font: `800 23px ${CHART_FONT}`,
                textAlign: 'center',
              },
            },
          ]
        : undefined,
    };
  }, [segments, centerText, ghost, theme]);

  const legend = ghost ? [] : segments;
  return (
    // Donut is the hero (no redundant caption); legend sits centred beneath it.
    <div className="flex w-full flex-col items-center gap-2">
      <div className="w-full" style={{ maxWidth: 216 }}>
        <EChart option={option} height={height} />
      </div>
      {legend.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-[12px] leading-snug text-muted">
          {legend.map((s) => (
            <span key={s.name} className={s.dim ? 'opacity-60' : ''}>
              <b style={{ color: s.color }}>■</b> {s.name}{' '}
              <b className="text-text">{Math.round(s.value * 10) / 10}%</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Gauge: single criticality-graded value with red/amber/green bands.
 * ------------------------------------------------------------------ */
export function MiniGauge({ pct, ghost, height = 172 }: { pct?: number; ghost?: boolean; height?: number }) {
  const theme = useChartTheme();
  const option = useMemo<EChartsOption>(() => {
    const v = ghost ? 0 : Math.min(100, Math.max(0, pct ?? 0));
    const bands: [number, string][] = ghost
      ? [[1, GHOST_SOFT]]
      : [
          [0.33, 'rgba(194,86,44,0.28)'],
          [0.67, 'rgba(201,162,39,0.28)'],
          [1, 'rgba(46,139,87,0.28)'],
        ];
    return {
      tooltip: { show: false },
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          // Sized to sit inside the card with margin (not spill to the edges) while
          // staying a touch larger than the original; thicker band for presence.
          radius: '92%',
          center: ['50%', '70%'],
          silent: true,
          axisLine: { lineStyle: { width: 15, color: bands } },
          progress: ghost
            ? { show: true, width: 15, itemStyle: { color: GHOST } }
            : { show: true, width: 15, itemStyle: { color: heatColor(v) } },
          pointer: ghost
            ? { show: false }
            : { show: true, length: '58%', width: 5, itemStyle: { color: theme.text } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: ghost
            ? { show: false }
            : {
                valueAnimation: true,
                offsetCenter: [0, '34%'],
                formatter: (val: number) => `${Math.round(val * 10) / 10}%`,
                color: theme.text,
                fontSize: 21,
                fontWeight: 800,
                fontFamily: CHART_FONT,
              },
          data: [{ value: ghost ? 40 : v }],
        },
      ],
    };
  }, [pct, ghost, theme]);
  return (
    // Constrained to the same width as MiniDonut so the two hero charts read as
    // one size across cards.
    <div className="mx-auto w-full" style={{ maxWidth: 216 }}>
      <EChart option={option} height={height} />
      {!ghost && (
        <div className="-mt-2 flex items-center justify-between px-2 text-[11px] font-semibold text-muted-2">
          <span>0%</span>
          <span className="text-[11px] font-normal">low → high availability</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
}

export interface MiniBarRow {
  label: string;
  magnitude: number;
  display: string;
  /** 0–100 goodness-bearing pct (colour), independent of bar length. */
  pct: number;
}

/* ------------------------------------------------------------------ *
 * Ranked top-N horizontal bars (state distribution for counts/amounts).
 * ------------------------------------------------------------------ */
export function MiniStateBars({
  rows,
  inverse,
  neutralColor,
  highlight,
  formatter = (v) => v.toLocaleString('en-US'),
  reference,
  referenceLabel,
  paletteColors,
  domainMax,
  ghost,
  ghostLabels,
}: {
  rows: MiniBarRow[];
  inverse?: boolean;
  /** Fixed colour for counts that must not be graded good/bad. */
  neutralColor?: string;
  highlight?: string;
  formatter?: (v: number) => string;
  /** Optional vertical reference line on the value axis (e.g. national mean). */
  reference?: number;
  referenceLabel?: string;
  /** Give each bar a distinct categorical colour (cycled) instead of one colour. */
  paletteColors?: string[];
  /** Fix the value axis to a known domain (e.g. 100 for a share-of-whole), so bar
   *  length reads as the true share rather than relative to the largest bar. */
  domainMax?: number;
  ghost?: boolean;
  ghostLabels?: string[];
}) {
  const theme = useChartTheme();
  const shown = ghost ? [] : rows;
  const labels = ghost ? ghostLabels ?? ['—', '—', '—', '—'] : shown.map((r) => r.label);
  const height = Math.max(labels.length * 26 + 12, 88);

  const option = useMemo<EChartsOption>(() => {
    const values = ghost ? (ghostLabels ?? ['—', '—', '—', '—']).map((_, i) => 80 - i * 18) : shown.map((r) => r.magnitude);
    const max = domainMax ?? Math.max(...values, reference ?? 0, 1) * 1.02;
    return {
      grid: { left: 2, right: 46, top: 6, bottom: 2, containLabel: true },
      tooltip: ghost
        ? { show: false }
        : {
            ...baseTooltip(theme),
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (p: any) => {
              const r = shown[p[0].dataIndex];
              return `<b>${r.label}</b><br/>${r.display}`;
            },
          },
      xAxis: { type: 'value', max, show: false },
      yAxis: {
        type: 'category',
        inverse: true,
        data: labels,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: theme.text,
          fontFamily: CHART_FONT,
          fontSize: 11,
          fontWeight: 600,
          formatter: (v: string) => wrapByWords(v, 14),
        },
      },
      series: [
        {
          type: 'bar',
          silent: ghost,
          barMaxWidth: 12,
          data: values.map((value, i) => ({
            value,
            itemStyle: {
              color: ghost
                ? GHOST
                : paletteColors
                  ? paletteColors[i % paletteColors.length]
                  : neutralColor ??
                    (inverse ? heatColor(100 - shown[i].pct) : heatColor(shown[i].pct)),
              opacity: !ghost && highlight && shown[i].label !== highlight ? 0.35 : 1,
              borderRadius: [0, 3, 3, 0],
            },
          })),
          label: ghost
            ? { show: false }
            : {
                show: true,
                position: 'right',
                color: theme.muted,
                fontFamily: CHART_FONT,
                fontSize: 10,
                formatter: (p: any) => formatter(shown[p.dataIndex].magnitude),
              },
          markLine:
            !ghost && reference != null
              ? {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: theme.text, width: 1.5, type: 'dashed', opacity: 0.55 },
                  label: {
                    formatter: referenceLabel ?? `${Math.round(reference * 10) / 10}`,
                    color: theme.muted,
                    fontFamily: CHART_FONT,
                    fontSize: 9.5,
                    position: 'insideEndTop',
                  },
                  data: [{ xAxis: reference }],
                }
              : undefined,
        },
      ],
    };
  }, [shown, labels, inverse, neutralColor, highlight, formatter, reference, referenceLabel, paletteColors, domainMax, ghost, ghostLabels, theme]);

  return <EChart option={option} height={height} />;
}

/* ------------------------------------------------------------------ *
 * State dot plot: each state's % on a 0–100 strip + national marker.
 * ------------------------------------------------------------------ */
export function MiniDotPlot({
  points,
  national,
  color = '#2E8B57',
}: {
  points: { label: string; value: number }[];
  national: number;
  color?: string;
}) {
  const theme = useChartTheme();
  const option = useMemo<EChartsOption>(() => {
    return {
      grid: { left: 6, right: 6, top: 8, bottom: 4, containLabel: true },
      tooltip: {
        ...baseTooltip(theme),
        formatter: (p: any) => `<b>${points[p.dataIndex].label}</b><br/>${points[p.dataIndex].value}%`,
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          color: theme.muted,
          fontFamily: CHART_FONT,
          fontSize: CHART_TYPE.axisLabel - 1.5,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: theme.grid } },
      },
      yAxis: { type: 'category', data: [''], axisLine: { show: false }, axisTick: { show: false } },
      series: [
        {
          type: 'scatter',
          symbolSize: 9,
          data: points.map((p) => ({
            value: [p.value, 0],
            itemStyle: { color: heatColor(p.value), opacity: 0.85 },
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: theme.text, width: 1.5, type: 'solid', opacity: 0.6 },
            label: {
              formatter: `Nat'l ${Math.round(national * 10) / 10}%`,
              color: theme.muted,
              fontFamily: CHART_FONT,
              fontSize: 9.5,
              position: 'insideEndTop',
            },
            data: [{ xAxis: national }],
          },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, national, color, theme]);
  return <EChart option={option} height={86} />;
}

/* ------------------------------------------------------------------ *
 * Trend columns: real period series from the ETL snapshot as vertical bars
 * (gaps stay gaps). A column chart reads discrete period volumes/rates better
 * than a line and keeps the dashboard line-free per the redesign brief.
 * ------------------------------------------------------------------ */
export function MiniTrendBars({
  data,
  categories,
  color = CHART_GREEN,
  formatter = (v) => v.toLocaleString('en-US'),
  height = 132,
}: {
  data: (number | null)[];
  categories: string[];
  color?: string;
  formatter?: (v: number) => string;
  height?: number;
}) {
  const theme = useChartTheme();
  // Trim leading/trailing all-null periods so the visible window is the covered period.
  const first = data.findIndex((v) => v != null);
  const lastIdx = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
  const window = first === -1 ? [] : data.slice(first, lastIdx + 1);
  const cats = first === -1 ? [] : categories.slice(first, lastIdx + 1);
  const lastPos = window.length - 1 - [...window].reverse().findIndex((v) => v != null);

  const option = useMemo<EChartsOption>(() => {
    return {
      grid: { left: 4, right: 10, top: 12, bottom: 2, containLabel: true },
      tooltip: {
        ...baseTooltip(theme),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => (v == null ? '—' : formatter(Number(v))),
      },
      xAxis: {
        type: 'category',
        data: cats,
        axisLabel: {
          color: theme.muted,
          fontFamily: CHART_FONT,
          fontSize: 9.5,
          hideOverlap: true,
        },
        axisLine: { lineStyle: { color: theme.axis } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: false,
        axisLabel: {
          color: theme.muted,
          fontFamily: CHART_FONT,
          fontSize: 9.5,
          formatter: (v: number) => formatter(v),
        },
        splitLine: { lineStyle: { color: theme.grid } },
        splitNumber: 3,
      },
      series: [
        {
          type: 'bar',
          data: window.map((value, i) => ({
            value,
            // The latest period is emphasised; earlier periods are muted context.
            itemStyle: {
              color,
              opacity: i === lastPos ? 1 : 0.45,
              borderRadius: [3, 3, 0, 0],
            },
          })),
          barMaxWidth: 26,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, categories, color, formatter, theme]);

  if (!window.length) return null;
  return <EChart option={option} height={height} />;
}
