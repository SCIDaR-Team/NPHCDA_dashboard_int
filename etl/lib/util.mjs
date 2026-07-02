/**
 * Small, dependency-free helpers shared across the ETL.
 * The ETL runs in Node (see ../build.mjs) — it never ships to the browser.
 */

/** Read a nested value by dotted path, tolerating missing intermediate objects. */
export function dig(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** Coerce a possibly-string/undefined value to a finite number (0 on failure). */
export function num(value) {
  if (value == null) return 0;
  const n = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Like `num`, but clamps negatives to 0. SFM ODK uses `-99` as a sentinel for
 * "not applicable / unknown" on several count fields — summed as-is it silently
 * corrupts totals (a handful of -99s can undercount a metric by 10%+).
 */
export function numPos(value) {
  return Math.max(0, num(value));
}

/** Clamp to the 0–100 band the UI uses for `pct`. */
export function clampPct(n) {
  return Math.max(0, Math.min(100, n));
}

/** Safe ratio → percent (returns null when the denominator is 0, so callers can gap it). */
export function ratioPct(numerator, denominator) {
  if (!denominator) return null;
  return clampPct((numerator / denominator) * 100);
}

/** Round to `d` decimals and return a Number. */
export function round(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/**
 * Walk a nested ODK submission and collect every `comm_status_<Drug>` leaf,
 * keyed by the drug slug, value lower-cased. ODK nests these under many groups.
 */
export function collectCommStatus(row) {
  const out = {};
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      const m = /^comm_status_(.+)$/.exec(k);
      if (m && typeof v === 'string') out[m[1]] = v.trim().toLowerCase();
      else if (v && typeof v === 'object') walk(v);
    }
  })(row);
  return out;
}

/** ODK/free-text "available" check that does not false-match "not available". */
export function isAvailable(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'available' || s === 'yes' || s === 'in_stock' || s === 'in stock';
}

const MONTH_NAMES = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Parse a month given as a number (1-12) or a name ("march", "May"). */
export function monthNum(value) {
  if (value == null) return 0;
  const s = String(value).trim().toLowerCase();
  if (MONTH_NAMES[s]) return MONTH_NAMES[s];
  return num(value);
}

/** Map a year + month (number or name) to a "YYYY Q#" quarter label, or null. */
export function toQuarter(year, month) {
  const y = num(year);
  const m = monthNum(month);
  if (!y || !m) return null;
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y} Q${q}`;
}

/** The 14 quarter labels the Trend page renders (2023 Q1 → 2026 Q2). */
export const QUARTER_LABELS = (() => {
  const out = [];
  let yr = 2023;
  let qt = 1;
  for (let i = 0; i < 14; i++) {
    out.push(`${yr} Q${qt}`);
    if (++qt > 4) {
      qt = 1;
      yr++;
    }
  }
  return out;
})();

/**
 * Turn a {quarterLabel -> value} map into a 14-length array aligned to
 * QUARTER_LABELS. Quarters with no real data become `null` (rendered as a gap,
 * never fabricated history).
 */
export function alignToQuarterFrame(byQuarter) {
  return QUARTER_LABELS.map((label) =>
    byQuarter[label] == null ? null : round(byQuarter[label], 2)
  );
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The 42 month labels the Trend page renders (Jan 2023 → Jun 2026). Must match
 *  `monthLabels` in src/data/calculations.ts. */
export const MONTH_LABELS = (() => {
  const out = [];
  let yr = 2023;
  let mo = 0;
  for (let i = 0; i < 42; i++) {
    out.push(`${MONTH_SHORT[mo]} ${yr}`);
    if (++mo > 11) {
      mo = 0;
      yr++;
    }
  }
  return out;
})();

/** "May 2026"-style month label from a year + month (number or name), or null. */
export function toMonthLabel(year, month) {
  const y = num(year);
  const m = monthNum(month);
  if (!y || !m || m < 1 || m > 12) return null;
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

/** Align a {monthLabel -> value} map to the 42-month MONTH_LABELS frame (null gaps). */
export function alignToMonthFrame(byMonth) {
  return MONTH_LABELS.map((label) => (byMonth[label] == null ? null : round(byMonth[label], 2)));
}
