/**
 * Authoritative PRIORITIZED-INDICATOR FRAMEWORK.
 *
 * Source of truth: docs/Prioritized Indicators mapped to data sources.xlsx — the
 * 41 rows flagged "Prioritize for executive dashboard = yes". This is deliberately
 * kept separate from the app's INDICATOR CARD catalogue (src/data/catalogue.ts),
 * because some dashboard cards bundle MORE THAN ONE prioritized indicator (e.g. the
 * BHCPF-vs-non-BHCPF mortality cards, the L1/L2/partial/non-functional facility-status
 * split). The card count (38) therefore understates the indicator count (41), and the
 * executive report must quote the framework figure, not the card figure.
 *
 * `live` is the count wired to a live data source (SRH / SFM / MAMII / PFMO). The
 * workbook itself mapped 29; PFMO wiring since then brings it to 31 (10 still await a
 * source). Update these three numbers when a new source is connected. The programme
 * `indicators` counts are how many of the 41 each programme feeds (overlapping — an
 * indicator fed by two programmes is counted under both).
 */
export interface IndicatorFramework {
  total: number;
  live: number;
  noSource: number;
  themes: { name: string; short: string; indicators: number }[];
  programmes: { name: string; indicators: number }[];
}

export const INDICATOR_FRAMEWORK: IndicatorFramework = {
  total: 41,
  live: 31,
  noSource: 10,
  // Facility Readiness is 19, not the app's 16 cards: the single "facility functional
  // status" card is 4 prioritized indicators in the spec (L2 / L1 / partial /
  // non-functional). 19 + 7 + 15 = 41.
  themes: [
    { name: 'Facility Readiness', short: 'Readiness', indicators: 19 },
    { name: 'Stock Status', short: 'Stock', indicators: 7 },
    { name: 'Service Delivery', short: 'Service', indicators: 15 },
  ],
  programmes: [
    { name: 'SRH', indicators: 15 },
    { name: 'SFM', indicators: 12 },
    { name: 'MAMII', indicators: 11 },
    { name: 'PFMO', indicators: 10 },
  ],
};
