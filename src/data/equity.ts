/**
 * Equity analysis — compares performance across equity strata using the SAME
 * per-state goodness the map and scorecard use, partitioned into groups.
 *
 * Available strata in the current snapshot: geopolitical ZONE and DONOR support
 * (donor-supported vs non-donor states). Rural/urban is NOT carried by any live
 * source, so it is intentionally absent (the page says so) rather than fabricated.
 *
 * A group's figure is the MEAN per-state goodness of the measured states in it, so
 * the equity view stays consistent with every state's map/deep-dive value.
 */

export interface GroupStat {
  group: string;
  /** Mean 0–100 goodness of the measured states in the group (null when none). */
  mean: number | null;
  /** Number of states with a measurement. */
  n: number;
  /** Best / worst state in the group by goodness. */
  best: { state: string; value: number } | null;
  worst: { state: string; value: number } | null;
}

/**
 * Group per-state values and summarise each group. `values` is state → 0–100 goodness
 * (only measured states present). `order` fixes the group ordering; empty groups are
 * still returned (mean null) so the layout is stable.
 */
export function groupMeans(
  values: Record<string, number>,
  groupOf: (state: string) => string | undefined,
  order: string[]
): GroupStat[] {
  const buckets = new Map<string, { state: string; value: number }[]>();
  for (const g of order) buckets.set(g, []);
  for (const [state, value] of Object.entries(values)) {
    const g = groupOf(state);
    if (g == null) continue;
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g)!.push({ state, value });
  }
  const stats: GroupStat[] = [];
  for (const [group, rows] of buckets) {
    if (!rows.length) {
      stats.push({ group, mean: null, n: 0, best: null, worst: null });
      continue;
    }
    const mean = +(rows.reduce((a, r) => a + r.value, 0) / rows.length).toFixed(1);
    const sorted = [...rows].sort((a, b) => b.value - a.value);
    stats.push({ group, mean, n: rows.length, best: sorted[0], worst: sorted[sorted.length - 1] });
  }
  return stats;
}

/** The equity gap between the highest and lowest measured group mean (null when < 2). */
export function equityGap(stats: GroupStat[]): number | null {
  const means = stats.map((s) => s.mean).filter((v): v is number => v != null);
  if (means.length < 2) return null;
  return +(Math.max(...means) - Math.min(...means)).toFixed(1);
}
