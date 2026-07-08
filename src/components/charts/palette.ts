/**
 * Unified chart colour system.
 *
 * ONE brand green is the visual anchor of every chart in the app, so a reader
 * instantly recognises the primary category by colour (Power BI / Looker style
 * consistency). The rules, applied everywhere:
 *
 *   • Single-category charts  → CHART_GREEN only (no hue variation).
 *   • Two-category charts      → CHART_GREEN for the primary/larger category,
 *                                CHART_GREEN_SOFT (lighter green) for the second.
 *   • Three+ category charts    → CHART_GREEN for the primary/largest category,
 *                                CHART_SECONDARY (a fixed, consistent set) for
 *                                the remaining categories — never random colours.
 *
 * Performance-graded encodings (the choropleth, gauge availability bands, the
 * bullet Poor/Fair/Good bands, status pills) intentionally keep the red→amber→
 * green heat scale in `heatColor`: there the colour is a good/bad SEMANTIC, not
 * a category identity, so it is exempt from the single-green rule.
 */

/** The brand green (#00A859) — the single primary chart colour app-wide. */
export const CHART_GREEN = '#00A859';

/** Lighter complementary green — the SECOND category in two-category charts. */
export const CHART_GREEN_SOFT = '#6FC69B';

/** Faint green — the recessive "remainder" slice in binary part-to-whole charts. */
export const CHART_GREEN_FAINT = '#B7DCC8';

/**
 * Fixed secondary palette for the non-primary categories of 3+ category charts.
 * Deliberately green-free so the primary green always stands alone, and ordered
 * so the same slot always yields the same hue across similar charts.
 */
export const CHART_SECONDARY = [
  '#3D7BB5', // blue
  '#C9A227', // gold
  '#7A4FA8', // violet
  '#C2562C', // terracotta
  '#5B7089', // slate
  '#2A9D8F', // teal
];

/** Nth secondary colour (cycles) — for the non-primary categories only. */
export function secondaryColor(i: number): string {
  return CHART_SECONDARY[i % CHART_SECONDARY.length];
}
