/**
 * Trend engine — the SINGLE source of the monthly trend series, shared (like
 * indicators.mjs) between the Node ETL (transform.mjs → national snapshot) and the
 * browser (src/data/scopedEngine.ts → filter-scoped trends). Re-running the SAME
 * function over the AND-filtered facts is why scoped trends never re-implement the
 * math and stay in lockstep with the national ones.
 *
 * Every source's tail is pinned to its last COMPLETE month (completeMonthSet): an
 * in-progress or typo'd final month with a fraction of the usual reporting facilities
 * is dropped to null, so a 1-facility partial month can't crash the line (or the KPI
 * "over period" deltas, which read the first/last non-null of these series).
 */
import { ratioPct, round, alignToMonthFrame, completeMonthSet } from './util.mjs';

const sum = (arr, f) => arr.reduce((a, r) => a + f(r), 0);

/** Group records by month, reduce each group, but only for months in `keep`. */
function byMonth(records, keep, aggFn) {
  const groups = {};
  for (const r of records) {
    if (!r.month || !keep.has(r.month)) continue;
    (groups[r.month] ||= []).push(r);
  }
  const out = {};
  for (const [m, rows] of Object.entries(groups)) out[m] = aggFn(rows);
  return out;
}

/* ------------------------------------------------------------------ *
 * PFMO national MONTHLY trends. PFMO's reporting volume swings widely month to
 * month, so raw COUNT sums are NOT comparable — the death / immunisation signals are
 * trended as volume-robust RATES (the SAME math as #58/#59/#87). Live births is the
 * one raw count (doubling as a reporting-coverage signal). The completeMonthSet gate
 * trims the in-progress tail month so it can't distort the line.
 * ------------------------------------------------------------------ */
function buildPfmoTrends(pfmoAll) {
  const keep = completeMonthSet(pfmoAll);
  const rate = (rows, numFn, per) => {
    const lb = sum(rows, (r) => r.livebirths);
    return lb ? (sum(rows, numFn) / lb) * per : null;
  };
  const penta = byMonth(pfmoAll, keep, (rows) => ratioPct(sum(rows, (r) => r.penta3), sum(rows, (r) => r.penta1)));
  const mmr = byMonth(pfmoAll, keep, (rows) => rate(rows, (r) => r.maternalDeaths, 100000));
  const u5mr = byMonth(pfmoAll, keep, (rows) => rate(rows, (r) => r.under5Deaths, 1000));
  const births = byMonth(pfmoAll, keep, (rows) => sum(rows, (r) => r.livebirths));
  return {
    'Penta 3 completion (%)': alignToMonthFrame(penta),
    'Maternal mortality ratio (per 100k)': alignToMonthFrame(mmr),
    'Under-5 mortality (per 1k)': alignToMonthFrame(u5mr),
    'Live births (count)': alignToMonthFrame(births),
  };
}

/**
 * All monthly trend series, from each source's ALL-submissions stream. SRH-native
 * rates come from SRH; facility deliveries from the deep SFM panel; PFMO supplies the
 * mortality/immunisation rates + live births. Series names carry "(count)" or "(%)"
 * so the UI rolls them up to quarter/year correctly (sum vs mean).
 */
export function buildTrends(srhAll, sfmAll, pfmoAll = []) {
  const srhKeep = completeMonthSet(srhAll);
  const sfmKeep = completeMonthSet(sfmAll);

  const anc1 = byMonth(srhAll, srhKeep, (rows) => {
    const lbv = sum(rows, (r) => r.livebirths);
    return ratioPct(lbv - sum(rows, (r) => r.lb0), lbv);
  });
  const anc4 = byMonth(srhAll, srhKeep, (rows) => ratioPct(sum(rows, (r) => r.lb5_7 + r.lb8plus), sum(rows, (r) => r.livebirths)));
  const fp = byMonth(srhAll, srhKeep, (rows) => ratioPct(sum(rows, (r) => r.fpModernUnits), sum(rows, (r) => r.fpTotal)));
  const pphAvail = byMonth(srhAll, srhKeep, (rows) => ratioPct(rows.filter((r) => r.pphBundleAvailable).length, rows.length));
  const deliveries = byMonth(sfmAll, sfmKeep, (rows) => sum(rows, (r) => r.deliveries));
  // SBA-attended deliveries — the SAME math as indicator #97 (SFM only): attended
  // deliveries ÷ facility deliveries, by complete month. Runs near-ceiling, so the
  // line reads as a stability signal rather than a swing.
  const sbaAttended = byMonth(sfmAll, sfmKeep, (rows) =>
    ratioPct(sum(rows, (r) => r.sbaAttendedDeliveries), sum(rows, (r) => r.deliveries))
  );

  return {
    'Facility deliveries (count)': alignToMonthFrame(deliveries),
    'ANC1 coverage (%)': alignToMonthFrame(anc1),
    'ANC4 coverage (%)': alignToMonthFrame(anc4),
    'Modern contraceptive use (%)': alignToMonthFrame(fp),
    'SBA-attended deliveries (%)': alignToMonthFrame(sbaAttended),
    'PPH bundle availability (%)': alignToMonthFrame(pphAvail),
    ...buildPfmoTrends(pfmoAll),
  };
}
