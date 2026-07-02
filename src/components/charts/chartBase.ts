import type { EChartsOption } from 'echarts';
import type { ChartTheme } from './chartTheme';

/**
 * Standardized chart configuration.
 *
 * Every chart in the app is built through these factories so that margins,
 * dynamic axis sizing, label wrapping, typography, tick/legend/tooltip styling
 * and spacing are consistent and never hand-tuned per chart. This is what keeps
 * category labels from clipping and the visual language uniform (Power BI / Looker
 * level of polish).
 */

/** Single Inter-based font stack used by all chart text. */
export const CHART_FONT =
  'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const CHART_TYPE = {
  axisLabel: 11,
  tick: 11,
  legend: 11.5,
  tooltip: 12,
  title: 13,
};

/** Word-aware wrapping: insert newlines so each line fits ~maxChars characters. */
export function wrapByWords(label: string, maxChars: number): string {
  if (!label) return label;
  const words = String(label).split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    let word = w;
    // Hard-break any single word longer than the line budget.
    while (word.length > maxChars) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!cur) cur = word;
    else if ((cur + ' ' + word).length <= maxChars) cur += ' ' + word;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}

function maxLines(labels: string[], maxChars: number): number {
  return labels.reduce((m, l) => Math.max(m, wrapByWords(l, maxChars).split('\n').length), 1);
}

/** Standard tooltip styling (confined to the container so it never overflows). */
export function baseTooltip(theme: ChartTheme): NonNullable<EChartsOption['tooltip']> {
  return {
    confine: true,
    backgroundColor: theme.tooltipBg,
    borderColor: theme.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: theme.text, fontFamily: CHART_FONT, fontSize: CHART_TYPE.tooltip },
    extraCssText: 'border-radius:10px;box-shadow:0 12px 40px -8px rgba(0,0,0,0.35);',
  };
}

function baseLegend(theme: ChartTheme): NonNullable<EChartsOption['legend']> {
  return {
    type: 'scroll',
    top: 0,
    itemWidth: 11,
    itemHeight: 11,
    itemGap: 14,
    textStyle: { color: theme.muted, fontFamily: CHART_FONT, fontSize: CHART_TYPE.legend },
  };
}

export interface HBarSeries {
  name?: string;
  color?: string;
  /** Per-bar values; for single series you may pass colors via `colorFor`. */
  data: number[];
  colorFor?: (value: number, index: number) => string;
}

export interface HBarParams {
  theme: ChartTheme;
  categories: string[];
  series: HBarSeries[];
  stacked?: boolean;
  max?: number;
  /** Characters per line before a category label wraps. Default 22. */
  labelMaxChars?: number;
  legend?: boolean;
  /** Tooltip value formatter; default appends "%". */
  valueFormatter?: (v: number) => string;
}

/**
 * Standardized horizontal bar chart.
 *
 * - `containLabel: true` + word-wrapped category labels => left margin grows to
 *   fit the longest label; nothing is ever clipped or ellipsised.
 * - Consistent bar thickness, spacing, axis + tooltip typography.
 */
export function horizontalBarOption(params: HBarParams): EChartsOption {
  const {
    theme,
    categories,
    series,
    stacked,
    max = 100,
    labelMaxChars = 22,
    legend = false,
    valueFormatter = (v) => `${v}%`,
  } = params;

  return {
    grid: {
      left: 6,
      right: 18,
      top: legend ? 30 : 8,
      bottom: 6,
      containLabel: true, // <- dynamic left margin sized to the (wrapped) labels
    },
    legend: legend ? baseLegend(theme) : undefined,
    tooltip: {
      ...baseTooltip(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => valueFormatter(Number(v)),
    },
    xAxis: {
      type: 'value',
      max,
      axisLabel: { color: theme.muted, fontFamily: CHART_FONT, fontSize: CHART_TYPE.axisLabel },
      splitLine: { lineStyle: { color: theme.grid } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: categories,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: theme.muted,
        fontFamily: CHART_FONT,
        fontSize: CHART_TYPE.axisLabel,
        lineHeight: 14,
        interval: 0,
        formatter: (v: string) => wrapByWords(v, labelMaxChars),
      },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      stack: stacked ? 'total' : undefined,
      data: s.data.map((value, i) => ({
        value,
        itemStyle: {
          color: s.colorFor ? s.colorFor(value, i) : s.color,
          borderRadius: stacked ? 0 : [0, 3, 3, 0],
        },
      })),
      barMaxWidth: 18,
      barCategoryGap: '32%',
    })),
  };
}

/** Recommended pixel height for a horizontal bar chart with N categories. */
export function horizontalBarHeight(
  categories: string[],
  opts: { labelMaxChars?: number; legend?: boolean; min?: number } = {}
): number {
  const { labelMaxChars = 22, legend = false, min = 160 } = opts;
  const lines = maxLines(categories, labelMaxChars);
  const rowH = Math.max(30, lines * 15 + 14);
  const chrome = (legend ? 36 : 12) + 16;
  return Math.max(min, categories.length * rowH + chrome);
}

export interface LineParams {
  theme: ChartTheme;
  categories: string[];
  series: { name: string; data: (number | null)[]; color: string; dashed?: boolean; silent?: boolean }[];
  smooth?: boolean;
  showSymbol?: boolean;
  yName?: string;
  legendData?: string[];
  xInterval?: number | 'auto';
}

/** Standardized line chart (trend analysis). */
export function lineOption(params: LineParams): EChartsOption {
  const { theme, categories, series, smooth = true, showSymbol = true, yName, legendData, xInterval = 'auto' } = params;
  return {
    grid: { left: 8, right: 20, top: 16, bottom: 56, containLabel: true },
    legend: { ...baseLegend(theme), bottom: 0, top: undefined, data: legendData },
    tooltip: { ...baseTooltip(theme), trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLabel: {
        color: theme.muted,
        fontFamily: CHART_FONT,
        fontSize: CHART_TYPE.axisLabel,
        interval: xInterval === 'auto' ? 'auto' : xInterval,
        hideOverlap: true,
      },
      axisLine: { lineStyle: { color: theme.axis } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: yName,
      nameTextStyle: { color: theme.muted, fontFamily: CHART_FONT, fontSize: CHART_TYPE.axisLabel, align: 'left' },
      axisLabel: { color: theme.muted, fontFamily: CHART_FONT, fontSize: CHART_TYPE.axisLabel },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth,
      showSymbol,
      symbolSize: 5,
      silent: s.silent,
      lineStyle: { width: s.dashed ? 1.4 : 2, type: s.dashed ? 'dashed' : 'solid', color: s.color, opacity: s.dashed ? 0.7 : 1 },
      itemStyle: { color: s.color },
      emphasis: { focus: 'series' },
      tooltip: s.silent ? { show: false } : undefined,
    })),
  };
}
