import { useMemo } from 'react';
import { EChart } from './EChart';
import { useChartTheme } from './chartTheme';
import { horizontalBarOption, horizontalBarHeight } from './chartBase';
import { decodeHtml } from '@/lib/format';

/**
 * Horizontal stacked "available vs not available" bar for composite indicators
 * (tracer commodities, PPH bundle, etc.). Built on the shared chart factory so
 * long commodity names (e.g. "Multiple Micronutrient Supplement (MMS)") wrap and
 * are never clipped.
 */
export function CompositeBreakdownChart({ items }: { items: [string, number][] }) {
  const theme = useChartTheme();
  const labels = items.map((it) => decodeHtml(it[0]));
  const labelMaxChars = 30;

  const option = useMemo(
    () =>
      horizontalBarOption({
        theme,
        categories: labels,
        stacked: true,
        legend: true,
        labelMaxChars,
        series: [
          { name: 'Available', color: '#22C55E', data: items.map((it) => 100 - it[1]) },
          { name: 'Not available', color: '#EF4444', data: items.map((it) => it[1]) },
        ],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, theme]
  );

  return <EChart option={option} height={horizontalBarHeight(labels, { labelMaxChars, legend: true, min: 200 })} />;
}
