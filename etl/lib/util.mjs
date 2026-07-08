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

/** Parse a "May 2026" label to a sortable YYYYMM integer, or null. */
export function monthLabelKey(label) {
  const [mon, yr] = String(label ?? '').split(' ');
  const i = MONTH_SHORT.indexOf(mon);
  return i >= 0 && yr ? Number(yr) * 100 + (i + 1) : null;
}

/** True when a reporting (year, month#) is AFTER the current calendar month — a
 *  data-entry typo (e.g. a report stamped "May 2027" that was actually submitted in
 *  2026). Such periods are dropped so they can't pollute the period range or trends. */
export function isFutureReport(year, month, now = new Date()) {
  const y = num(year);
  const m = monthNum(month);
  if (!y || !m) return false;
  return y * 100 + m > (now.getFullYear() * 100 + (now.getMonth() + 1));
}

/** Distinct-facility count per reporting month (keyed state|lga|facility). */
export function facilityCountByMonth(records) {
  const byMonth = {};
  for (const r of records) {
    if (!r.month) continue;
    (byMonth[r.month] ||= new Set()).add(`${r.state}|${r.lga}|${r.facility}`);
  }
  const out = {};
  for (const [m, set] of Object.entries(byMonth)) out[m] = set.size;
  return out;
}

const medianOf = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * The set of "complete" reporting months for a source — every month EXCEPT the
 * incomplete ENDS: a leading pilot/ramp-up month or a trailing in-progress/typo'd
 * month, both identified by a reporting-facility count far below the adjacent norm
 * (< `minFrac` of the median of the neighbouring `window` months). The walk stops at
 * the first complete month from each end, so it trims ONLY the sparse ends and never a
 * legitimate interior month where the panel was simply smaller — adapting to any scope
 * (national or a single filtered state). Used to pin trends, the KPI "over period"
 * deltas, and #71 to complete months instead of a 1-facility partial month.
 */
export function completeMonthSet(records, { minFrac = 0.5, window = 3 } = {}) {
  const counts = facilityCountByMonth(records);
  const months = Object.keys(counts).sort((a, b) => (monthLabelKey(a) ?? 0) - (monthLabelKey(b) ?? 0));
  const keep = new Set(months);
  // Trailing: walk back from the latest month while it's far below the prior norm.
  for (let i = months.length - 1; i >= 0; i--) {
    const prior = months.slice(Math.max(0, i - window), i).map((m) => counts[m]);
    if (!prior.length) break;
    if (counts[months[i]] < minFrac * medianOf(prior)) keep.delete(months[i]);
    else break;
  }
  // Leading: walk forward from the earliest month while it's far below the next norm.
  for (let i = 0; i < months.length; i++) {
    if (!keep.has(months[i])) continue; // already trimmed from the tail (tiny series)
    const next = months.slice(i + 1, i + 1 + window).map((m) => counts[m]);
    if (!next.length) break;
    if (counts[months[i]] < minFrac * medianOf(next)) keep.delete(months[i]);
    else break;
  }
  return keep;
}
