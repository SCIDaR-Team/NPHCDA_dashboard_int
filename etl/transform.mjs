/**
 * Transform layer: fold the per-source records into the exact shapes the app's
 * DataSource serves — keyed by the PRESERVED indicator names in
 * src/data/catalogue.ts. Anything we can't compute is simply left out and the
 * SnapshotDataSource renders it as the "Data not yet available" empty state.
 *
 * The per-indicator numerator/denominator math lives in ./lib/indicators.mjs
 * (buildIndicators) so the SAME function runs here (national) and in the browser
 * (src/data/scopedEngine.ts) over the AND-filtered record subset for compound
 * filtering. This file additionally emits a compact `facts` table (the slim
 * per-source records) that the app re-aggregates through that shared engine.
 */
import { ratioPct, clampPct, round, alignToMonthFrame } from './lib/util.mjs';
import { buildIndicators, mamiiFunctionalSplit } from './lib/indicators.mjs';

const sum = (arr, f) => arr.reduce((a, r) => a + f(r), 0);

/* ------------------------------------------------------------------ *
 * Real KPI strip, computed from live data.
 * ------------------------------------------------------------------ */
function firstLast(series) {
  const vals = series.filter((v) => v != null);
  if (vals.length < 2) return null;
  return { first: vals[0], last: vals[vals.length - 1] };
}
function sparkOf(series) {
  const vals = series.filter((v) => v != null).map((v) => round(v, 1));
  return vals.length ? vals : [0, 0];
}
function deltaOf(series, { pts } = {}) {
  const fl = firstLast(series);
  if (!fl) return { delta: 'Live', dir: 'up' };
  const diff = fl.last - fl.first;
  const dir = diff >= 0 ? 'up' : 'down';
  const val = pts ? `${diff >= 0 ? '+' : ''}${round(diff, 1)} pts` : `${diff >= 0 ? '+' : ''}${round((diff / (fl.first || 1)) * 100, 1)}%`;
  return { delta: `${val} over period`, dir };
}

function buildKpis(ind, trends) {
  const val = (name, fallback = '—') => (ind[name] ? ind[name].value : fallback);
  const pct = (name, fallback = 0) => (ind[name] ? ind[name].pct : fallback);

  const deliverTrend = trends['Facility deliveries (count)'] || [];
  const anc1Trend = trends['ANC1 coverage (%)'] || [];
  const fpTrend = trends['Modern contraceptive use (%)'] || [];
  const pphAvailTrend = trends['PPH bundle availability (%)'] || [];
  const pphDeathTrend = trends['Maternal deaths – PPH share (%)'] || [];

  return [
    {
      group: 'Service delivery (SRH live data)',
      cards: [
        {
          label: 'Facility deliveries (latest month)',
          indicator: 'Number of deliveries in facilities',
          value: val('Number of deliveries in facilities'),
          ...deltaOf(deliverTrend),
          target: 'Rising utilization of facility-based care',
          spark: sparkOf(deliverTrend),
          pct: pct('Number of deliveries in facilities', 60),
          inverse: false,
        },
        {
          label: 'ANC1 coverage',
          indicator: '% of women with a live birth who attended ANC 1',
          value: val('% of women with a live birth who attended ANC 1'),
          ...deltaOf(anc1Trend, { pts: true }),
          target: 'Entry point into the antenatal pathway',
          spark: sparkOf(anc1Trend),
          ring: pct('% of women with a live birth who attended ANC 1'),
          pct: pct('% of women with a live birth who attended ANC 1'),
          inverse: false,
        },
      ],
    },
    {
      group: 'Family planning &amp; commodities',
      cards: [
        {
          label: 'Modern contraceptive use',
          indicator: '% of family planning clients using modern contraceptives',
          value: val('% of family planning clients using modern contraceptives'),
          ...deltaOf(fpTrend, { pts: true }),
          target: 'Core measure of FP coverage',
          spark: sparkOf(fpTrend),
          ring: pct('% of family planning clients using modern contraceptives'),
          pct: pct('% of family planning clients using modern contraceptives'),
          inverse: false,
        },
        {
          label: 'PPH bundle availability',
          indicator: 'Proportion of facilities with the PPH bundle available*',
          value: val('Proportion of facilities with the PPH bundle available*'),
          ...deltaOf(pphAvailTrend, { pts: true }),
          target: 'Critical for preventing maternal deaths',
          spark: sparkOf(pphAvailTrend),
          ring: pct('Proportion of facilities with the PPH bundle available*'),
          pct: pct('Proportion of facilities with the PPH bundle available*'),
          inverse: false,
        },
      ],
    },
    {
      group: 'Maternal outcomes &amp; workforce',
      cards: [
        {
          label: 'Maternal deaths from PPH (share)',
          indicator: 'Proportion of maternal deaths resulting from PPH',
          value: val('Proportion of maternal deaths resulting from PPH'),
          ...deltaOf(pphDeathTrend, { pts: true }),
          target: 'Largest single preventable cause',
          spark: sparkOf(pphDeathTrend),
          ring: pct('Proportion of maternal deaths resulting from PPH'),
          ringInverse: true,
          pct: pct('Proportion of maternal deaths resulting from PPH'),
          inverse: true,
        },
        {
          label: 'Facilities with ≥4 SBAs',
          indicator: 'Proportion of facilities with a minimum of 4 SBAs',
          value: val('Proportion of facilities with a minimum of 4 SBAs'),
          delta: 'Live',
          dir: 'up',
          target: 'Indicates staffing adequacy',
          spark: [pct('Proportion of facilities with a minimum of 4 SBAs')],
          ring: pct('Proportion of facilities with a minimum of 4 SBAs'),
          pct: pct('Proportion of facilities with a minimum of 4 SBAs'),
          inverse: false,
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Real MONTHLY trends (honest gaps: null where a month has no data).
 * Deliveries use the SFM panel (May 2025 → May 2026, ~13 months); the SRH-native
 * rates use SRH (Jan → May 2026). Series names carry "(count)" or "(%)" so the UI
 * can roll them up correctly (sum vs mean) to quarterly/yearly.
 * ------------------------------------------------------------------ */
function byMonth(records, aggFn) {
  const groups = {};
  for (const r of records) {
    if (!r.month) continue;
    (groups[r.month] ||= []).push(r);
  }
  const out = {};
  for (const [m, rows] of Object.entries(groups)) out[m] = aggFn(rows);
  return out;
}

function buildTrends(srh, sfm, pfmo) {
  const s = srh.allRecords;
  const anc1 = byMonth(s, (rows) => {
    const lbv = sum(rows, (r) => r.livebirths);
    return ratioPct(lbv - sum(rows, (r) => r.lb0), lbv);
  });
  const anc4 = byMonth(s, (rows) => ratioPct(sum(rows, (r) => r.lb5_7 + r.lb8plus), sum(rows, (r) => r.livebirths)));
  const fp = byMonth(s, (rows) => ratioPct(sum(rows, (r) => r.fpModernUnits), sum(rows, (r) => r.fpTotal)));
  const pphAvail = byMonth(s, (rows) => ratioPct(rows.filter((r) => r.pphBundleAvailable).length, rows.length));
  // Facility deliveries — SFM panel, which carries the deep (~13-month) history.
  // Skip near-empty pilot months (< 20 facilities) so the series isn't distorted.
  const deliveries = byMonth(sfm.allRecords, (rows) =>
    rows.length >= 20 ? sum(rows, (r) => r.deliveries) : null
  );

  return {
    'Facility deliveries (count)': alignToMonthFrame(deliveries),
    'ANC1 coverage (%)': alignToMonthFrame(anc1),
    'ANC4 coverage (%)': alignToMonthFrame(anc4),
    'Modern contraceptive use (%)': alignToMonthFrame(fp),
    'PPH bundle availability (%)': alignToMonthFrame(pphAvail),
    ...buildPfmoTrends(pfmo),
  };
}

/* ------------------------------------------------------------------ *
 * PFMO national MONTHLY trends. PFMO's reporting volume swings widely month to
 * month (a few thousand → ~28k facilities), so raw COUNT sums are NOT comparable
 * across months. The death / immunisation signals are therefore trended as
 * volume-robust RATES — the SAME math as indicators #58 (MMR), #59 (U5MR) and
 * #87 (Penta3 completion) — which normalise for how many facilities reported.
 * Live births is kept as the one raw count (it doubles as a reporting-coverage
 * signal). A per-month reporting-facility floor gaps any partial month so it can't
 * distort the tail (the 42-month frame already drops the current in-progress month).
 * ------------------------------------------------------------------ */
const PFMO_MIN_FACILITIES = 500;
function buildPfmoTrends(pfmo) {
  const recs = pfmo.allRecords || pfmo.records || [];
  // Only plot a month once enough facilities have reported it.
  const guarded = (fn) => (rows) => (rows.length >= PFMO_MIN_FACILITIES ? fn(rows) : null);
  const rate = (rows, numFn, per) => {
    const lb = sum(rows, (r) => r.livebirths);
    return lb ? (sum(rows, numFn) / lb) * per : null;
  };

  const penta = byMonth(recs, guarded((rows) => ratioPct(sum(rows, (r) => r.penta3), sum(rows, (r) => r.penta1))));
  const mmr = byMonth(recs, guarded((rows) => rate(rows, (r) => r.maternalDeaths, 100000)));
  const u5mr = byMonth(recs, guarded((rows) => rate(rows, (r) => r.under5Deaths, 1000)));
  const births = byMonth(recs, guarded((rows) => sum(rows, (r) => r.livebirths)));

  return {
    'Penta 3 completion (%)': alignToMonthFrame(penta),
    'Maternal mortality ratio (per 100k)': alignToMonthFrame(mmr),
    'Under-5 mortality (per 1k)': alignToMonthFrame(u5mr),
    'Live births (count)': alignToMonthFrame(births),
  };
}

/* ------------------------------------------------------------------ *
 * State readiness scores (real) for the choropleth map.
 * ------------------------------------------------------------------ */
function buildStateScores(srh, sfm) {
  const byState = {};
  const push = (st, metric) => {
    if (st == null || metric == null) return;
    (byState[st] ||= []).push(clampPct(metric));
  };
  for (const r of srh.records) {
    const lb = r.livebirths;
    push(r.state, lb ? ((lb - r.lb0) / lb) * 100 : null); // ANC1
    push(r.state, r.pphBundleAvailable ? 100 : 0); // commodity readiness
    push(r.state, r.sbaCount >= 4 ? 100 : 0); // staffing
  }
  for (const r of sfm.records) {
    push(r.state, r.pphBundleAvailable ? 100 : 0);
    push(r.state, r.minFourSbas ? 100 : 0);
  }
  const out = {};
  for (const [st, arr] of Object.entries(byState)) {
    out[st] = round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Facility roster (real rows for the Facility Deepdive matrix).
 * ------------------------------------------------------------------ */
function facTypeSrh(t) {
  return /cemonc/i.test(String(t)) ? 'CEmONC' : 'BEmONC';
}
function facTypeSfm(designation) {
  return /secondary|tert/i.test(String(designation)) ? 'CEmONC' : 'BEmONC';
}
function facStatus(r) {
  if (r.deliveries > 0 && r.pphBundleAvailable) return 'L2';
  if (r.deliveries > 0) return 'L1';
  if ((r.commAvailableCount ?? 0) > 0 || r.pphBundleAvailable) return 'Partial';
  return 'Non-functional';
}

function buildFacilities(srh, sfm, sheet) {
  const byKey = new Map();
  for (const r of srh.records) {
    const key = `${r.state}|${r.lga}|${r.facility}`;
    byKey.set(key, {
      state: r.state,
      zone: r.zone,
      donor: r.donor,
      lga: r.lga,
      ward: r.lga,
      facility: r.facility,
      type: facTypeSrh(r.facilityType),
      status: facStatus(r),
      tracer: round(r.commAvailableCount ?? 0),
      satisfaction: 0,
      penta3: 0,
      maternalDeaths: r.matDeaths,
    });
  }
  for (const r of sfm.records) {
    const key = `${r.state}|${r.lga}|${r.facility}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      state: r.state,
      zone: r.zone,
      donor: r.donor,
      lga: r.lga,
      ward: r.lga,
      facility: r.facility,
      type: facTypeSfm(r.designation),
      status: r.minFourSbas && r.pphBundleAvailable ? 'L2' : r.deliveries > 0 ? 'L1' : 'Partial',
      tracer: r.pphBundleAvailable ? 5 : 0,
      satisfaction: 0,
      penta3: 0,
      maternalDeaths: 0,
    });
  }
  // SRH baseline Google-Sheet facilities (dedup against ODK). Status here is a
  // documented STAFFING-readiness proxy — the sheet doesn't classify L1/L2
  // functionality directly, so ≥4 SBAs → L2, 1–3 → L1, 0 → Partial.
  for (const r of sheet.records) {
    const key = `${r.state}|${r.lga}|${r.facility}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      state: r.state,
      zone: r.zone,
      donor: r.donor,
      lga: r.lga,
      ward: r.lga,
      facility: r.facility,
      type: facTypeSrh(r.facilityType),
      status: r.sbaCount >= 4 ? 'L2' : r.sbaCount >= 1 ? 'L1' : 'Partial',
      tracer: round(r.commAvailableCount ?? 0),
      satisfaction: 0,
      penta3: 0,
      maternalDeaths: 0,
    });
  }
  return [...byKey.values()];
}

/* ------------------------------------------------------------------ *
 * Compact fact table — the slim per-source records the app re-aggregates through
 * the SHARED indicator engine for COMPOUND (AND-of-all-filters) scoping.
 *
 * We ship each source's full record stream (ODK: allRecords; the Sheet is a
 * one-time baseline with no reporting period, so just its records) and stamp a
 * normalised `type` (CEmONC / BEmONC) on every row — matching buildFacilities —
 * so the app can filter by facilityType too. The app derives latest-per-facility
 * from these when no period filter is active, exactly as the adapters do.
 * ------------------------------------------------------------------ */
function stampType(records, typer) {
  return records.map((r) => ({ ...r, type: typer(r) }));
}

function buildFacts(srh, sfm, sheet, mamii, pfmo) {
  return {
    srh: stampType(srh.allRecords || srh.records, (r) => facTypeSrh(r.facilityType)),
    sfm: stampType(sfm.allRecords || sfm.records, (r) => facTypeSfm(r.designation)),
    sheet: stampType(sheet.records, (r) => facTypeSrh(r.facilityType)),
    // MAMII carries no facility-type dimension → stamp null (a facilityType filter
    // naturally excludes MAMII, which is honest). Rows have no reporting month, so a
    // period filter excludes them too, exactly like the Sheet baseline.
    mamii: stampType(mamii.records || [], () => null),
    // PFMO ships allRecords (one row per facility-month) so the browser engine can
    // sum flows / scope by period exactly as the ETL does. SLIMMED to the fields the
    // engine reads — dims, flow counts, and the pre-computed #17/#27/#47 booleans —
    // because the raw commodity/service/equipment arrays for 54k rows blew the
    // snapshot past GitHub's 100MB file cap. Type is null (PFMO has no BEmONC/CEmONC),
    // so a facilityType filter excludes it — honest.
    pfmo: (pfmo.allRecords || pfmo.records || []).map((r) => ({
      state: r.state, zone: r.zone, donor: r.donor, lga: r.lga, facility: r.facility,
      type: null, month: r.month, submittedAt: r.submittedAt,
      livebirths: r.livebirths, maternalDeaths: r.maternalDeaths, under5Deaths: r.under5Deaths,
      penta1: r.penta1, penta3: r.penta3,
      commReported: r.commReported, tracer6: r.tracer6,
      svcReported: r.svcReported, svc6: r.svc6,
      equipReported: r.equipReported, equip5: r.equip5,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Facility functional status (#30-33) — the L2 / L1 / partial / non-functional
 * split. Per the indicator workbook, MAMII is the SOLE mapped source: L2/L1/Partial
 * come from MAMII's LGA columns and Non-functional is derived (Total − L2 − L1 −
 * Partial). Partial (and thus Non-functional) are a REAL reported 0 in the current
 * data, not a gap. Emitted as a normal indicator measurement so the SnapshotDataSource
 * overlays its split4 onto the catalogue card. The workbook's "BHCPF vs non-BHCPF" cut
 * needs PFMO, which isn't connected, so we publish the overall split.
 * ------------------------------------------------------------------ */
const FUNCTIONAL_STATUS_INDICATOR = 'Facility functional status per state (L1 / L2 / partial / non-functional)';

function buildFunctionalStatus(mamii) {
  const split = mamiiFunctionalSplit(mamii.records || []);
  if (!split) return null;
  const { l2, l1, partial, nonfunc, total, states } = split;
  return {
    pct: round(l2 + l1), // "functional" (L1+L2) share drives the card's goodness colour
    value: 'see split',
    split4: { l2, l1, partial, nonfunc },
    n: total,
    meta: `MAMII: ${total.toLocaleString('en-US')} BHCPF facilities across ${states} states — L2 ${l2}% · L1 ${l1}% · partial ${partial}% · non-functional ${nonfunc}%. Source: MAMII (the sole source the indicator workbook maps for this split); non-functional derived = total − (L2+L1+partial). BHCPF vs. non-BHCPF split needs PFMO (not yet connected).`,
  };
}

export function transform({ srh, sfm, sheet, mamii = { records: [] }, pfmo = { records: [], allRecords: [] } }) {
  const indicators = buildIndicators(srh, sfm, sheet, mamii, pfmo);
  const facts = buildFacts(srh, sfm, sheet, mamii, pfmo);
  const trends = buildTrends(srh, sfm, pfmo);
  const kpis = buildKpis(indicators, trends);
  const stateScores = buildStateScores(srh, sfm);
  const facilities = buildFacilities(srh, sfm, sheet);
  const facStatus = buildFunctionalStatus(mamii);
  if (facStatus) indicators[FUNCTIONAL_STATUS_INDICATOR] = facStatus;
  return { indicators, facts, kpis, trends, stateScores, facilities, sheet };
}
