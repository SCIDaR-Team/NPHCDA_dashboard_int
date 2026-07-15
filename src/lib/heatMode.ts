/**
 * Colour-blind-safe mode for the performance heat scale.
 *
 * The default good→bad scale is red→amber→green, which is hard to read for the
 * ~8% of men with red-green colour vision deficiency. When CVD-safe mode is on,
 * `heatColor` (src/data/calculations.ts) switches to the perceptually-uniform,
 * CVD-safe **viridis** ramp (deep purple → teal → yellow) where high = yellow.
 *
 * The preference lives in the theme store (persisted). We mirror it here as a
 * plain module variable so the pure `heatColor` helper can branch on it without
 * importing a React store (keeping the data layer free of UI dependencies). The
 * store is the single writer; components re-render via the store subscription.
 */

let cvdSafe = false;

export function getCvdSafe(): boolean {
  return cvdSafe;
}

export function setCvdSafe(v: boolean): void {
  cvdSafe = v;
}
