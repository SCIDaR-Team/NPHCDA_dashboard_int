import type { TrendSeries } from '../types';

/**
 * Trend Analysis source series — 14 quarterly points each (2023 Q1 → 2026 Q2).
 * Monthly and yearly granularities are derived from these in calculations.ts.
 */
export const trendSeries: TrendSeries = {
  "Facilities reporting (count)": [142,151,158,167,176,184,193,202,211,221,232,241,251,259],
  "Penta 3 coverage (%)":      [75,76,77,78,79,80,81,82,83,84,85,86,87,88],
  "Zero-dose children (%)":    [22,21,20,19,18,17,17,16,15,15,14,14,13,13],
  "Facilities w/ SRH stock risk (%)": [40,38,36,34,32,30,28,27,25,24,22,21,19,18],
  "Wards w/ functional PHC (%)": [54,55,57,58,59,60,62,63,64,65,66,67,68,69],
  "SBA-attended deliveries (%)": [58,59,61,62,64,65,67,68,69,70,72,73,74,75],
  "Maternal Mortality Ratio (/100,000)": [742,728,712,698,684,670,658,646,636,628,620,615,608,602],
  "Patient satisfaction (%)":  [56,58,60,62,64,66,68,70,72,73,75,76,77,78],
  "Budget utilization (%)":    [60,68,72,65,70,75,71,78,73,80,76,82,77,81],
};

export const trendColors: string[] = ["#38BDF8","#1B5E3A","#2E8B57","#C9A227","#6FA888","#8a6d12","#C2562C","#3D7BB5","#7A4FA8"];

export const defaultsOn = [
  'Facilities reporting (count)',
  'Penta 3 coverage (%)',
  'Patient satisfaction (%)',
];
