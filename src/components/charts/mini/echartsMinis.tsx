import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from '../EChart';
import { useChartTheme } from '../chartTheme';
import { baseTooltip, CHART_FONT, CHART_TYPE, wrapByWords } from '../chartBase';
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
  centerSub,
  ghost,
  height = 132,
}: {
  segments: DonutSegment[];
  centerText?: string;
  centerSub?: string;
  ghost?: boolean;
  height?: number;
}) {
  const theme = useChartTheme();
  // A long sub-label (e.g. "Pre-eclampsia/eclampsia") won't fit inside the donut
  // hole, so render it as a caption BENEATH the chart and centre the % in the hole.
  // Short labels ("PPH", "Sepsis") stay in the centre.
  const subBelow = !!centerSub && centerSub.length > 14;
  const centerSubInHole = centerSub && !subBelow ? centerSub : undefined;
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
          radius: ['62%', '86%'],
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
              top: centerSubInHole ? '40%' : 'middle',
              style: {
                text: centerText,
                fill: ghost ? GHOST : theme.text,
                font: `800 15px ${CHART_FONT}`,
                textAlign: 'center',
              },
            },
            ...(centerSubInHole
              ? [
                  {
                    type: 'text' as const,
                    left: 'center',
                    top: '58%',
                    style: {
                      text: centerSubInHole,
                      fill: theme.muted,
                      font: `600 9.5px ${CHART_FONT}`,
                      textAlign: 'center' as const,
                    },
                  },
                ]
              : []),
          ]
        : undefined,
    };
  }, [segments, centerText, centerSubInHole, ghost, theme]);

  const legend = ghost ? [] : segments;
  return (
    <div className="flex items-center gap-2">
      <div className="w-[132px] flex-shrink-0">
        <EChart option={option} height={height} />
        {subBelow && (
          <div className="-mt-1 text-center text-[10px] font-semibold leading-tight text-muted">
            {centerSub}
          </div>
        )}
      </div>
      {legend.length > 0 && (
        <div className="min-w-0 space-y-1 text-[10.5px] leading-snug text-muted">
          {legend.map((s) => (
            <div key={s.name} className={s.dim ? 'opacity-60' : ''}>
              <b style={{ color: s.color }}>■</b> {s.name}{' '}
              <b className="text-text">{Math.round(s.value * 10) / 10}%</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Gauge: single criticality-graded value with red/amber/green bands.
 * ------------------------------------------------------------------ */
export function MiniGauge({ pct, ghost, height = 118 }: { pct?: number; ghost?: boolean; height?: number }) {
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
          radius: '100%',
          center: ['50%', '68%'],
          silent: true,
          axisLine: { lineStyle: { width: 12, color: bands } },
          progress: ghost
            ? { show: true, width: 12, itemStyle: { color: GHOST } }
            : { show: true, width: 12, itemStyle: { color: heatColor(v) } },
          pointer: ghost
            ? { show: false }
            : { show: true, length: '58%', width: 4, itemStyle: { color: theme.text } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: ghost
            ? { show: false }
            : {
                valueAnimation: true,
                offsetCenter: [0, '28%'],
                formatter: (val: number) => `${Math.round(val * 10) / 10}%`,
                color: theme.text,
                fontSize: 15,
                fontWeight: 800,
                fontFamily: CHART_FONT,
              },
          data: [{ value: ghost ? 40 : v }],
        },
      ],
    };
  }, [pct, ghost, theme]);
  return <EChart option={option} height={height} />;
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
  ghost,
  ghostLabels,
}: {
  rows: MiniBarRow[];
  inverse?: boolean;
  /** Fixed colour for counts that must not be graded good/bad. */
  neutralColor?: string;
  highlight?: string;
  formatter?: (v: number) => string;
  ghost?: boolean;
  ghostLabels?: string[];
}) {
  const theme = useChartTheme();
  const shown = ghost ? [] : rows;
  const labels = ghost ? ghostLabels ?? ['—', '—', '—', '—'] : shown.map((r) => r.label);
  const height = Math.max(labels.length * 24 + 10, 82);

  const option = useMemo<EChartsOption>(() => {
    const values = ghost ? (ghostLabels ?? ['—', '—', '—', '—']).map((_, i) => 80 - i * 18) : shown.map((r) => r.magnitude);
    const max = Math.max(...values, 1);
    return {
      grid: { left: 2, right: 44, top: 2, bottom: 2, containLabel: true },
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
      xAxis: { type: 'value', max: max * 1.02, show: false },
      yAxis: {
        type: 'category',
        inverse: true,
        data: labels,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: theme.muted,
          fontFamily: CHART_FONT,
          fontSize: 10.5,
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
        },
      ],
    };
  }, [shown, labels, inverse, neutralColor, highlight, formatter, ghost, ghostLabels, theme]);

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
 * Trend area: real quarterly series from the ETL snapshot (gaps stay gaps).
 * ------------------------------------------------------------------ */
export function MiniTrendArea({
  data,
  categories,
  color = '#2E8B57',
  formatter = (v) => v.toLocaleString('en-US'),
}: {
  data: (number | null)[];
  categories: string[];
  color?: string;
  formatter?: (v: number) => string;
}) {
  const theme = useChartTheme();
  // Trim leading/trailing all-null quarters so the visible window is the covered period.
  const first = data.findIndex((v) => v != null);
  const lastIdx = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
  const window = first === -1 ? [] : data.slice(first, lastIdx + 1);
  const cats = first === -1 ? [] : categories.slice(first, lastIdx + 1);

  const option = useMemo<EChartsOption>(() => {
    return {
      grid: { left: 4, right: 8, top: 8, bottom: 2, containLabel: true },
      tooltip: {
        ...baseTooltip(theme),
        trigger: 'axis',
        valueFormatter: (v) => (v == null ? '—' : formatter(Number(v))),
      },
      xAxis: {
        type: 'category',
        data: cats,
        boundaryGap: false,
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
        scale: true,
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
          type: 'line',
          data: window,
          smooth: true,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          areaStyle: { opacity: 0.14, color },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, categories, color, formatter, theme]);

  if (!window.length) return null;
  return <EChart option={option} height={104} />;
}
