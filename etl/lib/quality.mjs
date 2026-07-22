/**
 * Record-level data-quality guards, shared by the ETL and the browser.
 *
 * Two defects were found in the SFM ODK panel (2026-07-20):
 *
 *  1. DUPLICATE SUBMISSIONS — the same facility-month posted twice at an identical
 *     `submittedAt`. Four groups exist. Three are byte-identical twins that simply
 *     double-count (Ebonyi's Gh Itimukwu overstated deliveries by 11). The fourth,
 *     Plateau / Phc Jos Jarawa / Jun 2025, has two CONFLICTING versions of the same
 *     report: 2 deaths + 2 PPH, versus 4 deaths + 14 PPH + 3 pre-eclampsia + 3 sepsis.
 *     Both were being counted.
 *
 *  2. IMPOSSIBLE CAUSE ATTRIBUTION — that second version attributes 20 causes to 4
 *     deaths. Cause counts cannot exceed the deaths they explain; the figure alone
 *     drove Plateau's PPH share to 133% and its "other causes" share to −67%.
 *
 * These run at source-load time in the ETL, and again when the browser reads a
 * snapshot, so an already-published snapshot is corrected without a data refresh.
 */

/** Cause fields that must sum to no more than the recorded maternal deaths. */
const CAUSE_FIELDS = ['matPPH', 'matHTN', 'matSepsis'];

const causeTotal = (r) => CAUSE_FIELDS.reduce((a, f) => a + (Number(r?.[f]) || 0), 0);

/** True when a row attributes more causes than it records deaths — impossible, so
 *  its cause breakdown can't be trusted (the death count itself still can). */
export function hasImpossibleCauses(r) {
  return causeTotal(r) > (Number(r?.matDeaths) || 0);
}

/** Identity of a single submitted report. Rows agreeing on all five are the same
 *  report received more than once — never two real facility-months. */
const submissionKey = (r) =>
  [r?.state ?? '', r?.lga ?? '', r?.facility ?? '', r?.month ?? '', r?.submittedAt ?? ''].join('|');

/**
 * Collapse duplicate submissions to one row each.
 *
 * When duplicates disagree, the internally-consistent version wins — a report whose
 * causes exceed its deaths is self-contradicting, so the version that isn't carries
 * the better claim to being real. Ties keep the first row, so the result is stable
 * and order-independent for identical twins.
 */
export function dedupeSubmissions(records, onDrop) {
  const byKey = new Map();
  for (const r of records) {
    const key = submissionKey(r);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      continue;
    }
    // Keep whichever version is internally consistent; otherwise keep the first.
    const prevBad = hasImpossibleCauses(prev);
    const nextBad = hasImpossibleCauses(r);
    const winner = prevBad && !nextBad ? r : prev;
    const loser = winner === prev ? r : prev;
    byKey.set(key, winner);
    onDrop?.(loser, winner);
  }
  return [...byKey.values()];
}

/**
 * Void the cause breakdown on rows that attribute more causes than deaths. The
 * death count is preserved — only the untrustworthy attribution is cleared, so the
 * deaths still count toward mortality while dropping out of the cause shares.
 */
export function voidImpossibleCauses(records, onVoid) {
  return records.map((r) => {
    if (!hasImpossibleCauses(r)) return r;
    onVoid?.(r);
    const clean = { ...r };
    for (const f of CAUSE_FIELDS) clean[f] = 0;
    return clean;
  });
}

/**
 * Both guards, in order: drop duplicate reports, then void any surviving row whose
 * cause attribution is impossible. Returns the cleaned records plus a count of what
 * each guard acted on, for the ETL log.
 */
export function sanitizeRecords(records, label = '') {
  if (!Array.isArray(records)) return { records, dropped: 0, voided: 0 };
  const dropped = [];
  const deduped = dedupeSubmissions(records, (loser) => dropped.push(loser));
  const voided = [];
  const clean = voidImpossibleCauses(deduped, (r) => voided.push(r));
  if (label && (dropped.length || voided.length)) {
    console.warn(
      `[quality] ${label}: dropped ${dropped.length} duplicate submission(s), ` +
        `voided cause attribution on ${voided.length} row(s)`
    );
    for (const r of dropped) {
      console.warn(`[quality]   duplicate → ${r.state} / ${r.facility} / ${r.month}`);
    }
    for (const r of voided) {
      console.warn(
        `[quality]   impossible causes → ${r.state} / ${r.facility} / ${r.month}: ` +
          `${causeTotal(r)} causes vs ${Number(r.matDeaths) || 0} deaths`
      );
    }
  }
  return { records: clean, dropped: dropped.length, voided: voided.length };
}
