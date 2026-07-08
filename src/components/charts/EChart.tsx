import { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useThemeStore } from '@/store/themeStore';
import { cssVar } from './chartTheme';
import { CHART_FONT } from './chartBase';

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  onEvents?: Record<string, (params: any) => void>;
}

/**
 * Theme-aware echarts-for-react wrapper.
 *
 * A ResizeObserver re-sizes the chart whenever its container changes — this is
 * what keeps deep-dive charts inside the (animating) modal from rendering at a
 * stale/zero width, which previously clipped axis labels and ticks.
 */
export function EChart({ option, height = 320, className, onEvents }: EChartProps) {
  const theme = useThemeStore((s) => s.theme);
  const chartRef = useRef<ReactECharts>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Apply a consistent global font + text colour so all chart text (axes, ticks,
  // legend, tooltip, labels) renders crisply in the app's Inter typeface.
  const themedOption = useMemo<EChartsOption>(() => {
    const baseText = cssVar('--c-text-soft');
    return {
      ...option,
      textStyle: { fontFamily: CHART_FONT, color: baseText, ...(option.textStyle as object) },
    };
    // theme included so colours refresh on toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option, theme]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Resolve the LIVE instance on every call (never a captured reference): the inner
    // ReactECharts remounts on a theme toggle (key={theme}), disposing the old chart —
    // a stale reference would then resize a disposed instance and spam ECharts warnings.
    const resize = () => {
      const inst = chartRef.current?.getEchartsInstance();
      if (inst && !inst.isDisposed()) inst.resize();
    };
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    // A couple of deferred resizes catch the modal's open animation settling.
    const t1 = window.setTimeout(resize, 60);
    const t2 = window.setTimeout(resize, 320);
    // Canvas text doesn't re-flow when a web font loads — redraw once Inter is ready
    // so all chart typography renders in the app font rather than a fallback.
    let cancelled = false;
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) resize();
      });
    }
    return () => {
      cancelled = true;
      ro.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', height }} className={className}>
      <ReactECharts
        ref={chartRef}
        key={theme}
        option={themedOption}
        notMerge
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
        onEvents={onEvents}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
