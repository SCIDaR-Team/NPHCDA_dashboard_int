/**
 * Indicator engine — the SINGLE source of per-indicator numerator/denominator math.
 *
 * `buildIndicators()` folds a bundle of per-source records into the measured
 * figures keyed by the PRESERVED indicator names. It is deliberately dependency-
 * free (only the pure helpers in ./util.mjs) so it can run in BOTH environments:
 *   - the Node ETL (transform.mjs) → national + facts snapshot;
 *   - the browser app (src/data/scopedEngine.ts) → compound-filter scoping, by
 *     re-running this EXACT function over the AND-filtered record subset.
 *
 * This is why filter compounding is faithful and never re-implements the math: the
 * app calls this same function, just over fewer records. Anything a scope can't
 * compute is simply omitted (put() skips null pct) → the UI renders "No data".
 */
import { ratioPct, clampPct, round, MONTH_LABELS } from './util.mjs';

const sum = (arr, f) => arr.reduce((a, r) => a + f(r), 0);
const pctStr = (p) => `${round(p)}%`;

/** Format a naira amount, scaling the unit so small (facility-level) amounts stay
 *  precise — millions rounded to 0.1 lose amounts under ~₦50k (they'd read "₦0m"),
 *  which then look like "no funds". k/m/bn keeps every real amount visible. */
const fmtNaira = (v) => {
  if (v >= 1e9) return `₦${round(v / 1e9, 2)}bn`;
  if (v >= 1e6) return `₦${round(v / 1e6, 1)}m`;
  if (v >= 1e3) return `₦${round(v / 1e3)}k`;
  return `₦${Math.round(v)}`;
};

/** Group records by their month label and reduce each group with `aggFn`. */
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

/** Keep the first record per distinct key — used to collapse MAMII's denormalised
 *  state/LGA-native columns to ONE row per state/LGA before summing (never sum a
 *  state total across its facility rows). */
function dedupeBy(records, keyOf) {
  const seen = new Map();
  for (const r of records) {
    const k = keyOf(r);
    if (k != null && !seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

/** Neutral pct for MAMII count indicators (no target denominator exists, so the
 *  bar must not imply a good/bad performance grade — the real figure is the count
 *  in `value`, and the meta says so). */
const MAMII_COUNT_PCT = 50;
const fmtCount = (n) => Math.round(n).toLocaleString('en-US');

/**
 * MAMII aggregate indicators (#3/#4/#6/#7/#9/#10/#34), folded onto the preserved
 * catalogue names. MAMII is a facility-grained dataset whose columns are DENORMALISED
 * at three levels, so each is reduced at its NATIVE grain before summing:
 *   • facility-native (SBAs recruited/deployed) → sum over facility rows;
 *   • state-native (CBHW workforce)            → dedupe to one row per state;
 *   • LGA-native (revitalised PHCs)            → dedupe to one row per LGA.
 * Runs over the (possibly filter-scoped) MAMII records, so it composes with the
 * browser's compound scoping exactly like the ODK engine. `put` skips null pct, so
 * a scope with no MAMII rows simply omits these (→ card shows out-of-scope).
 */
function addMamiiIndicators(mam, put) {
  if (!mam.length) return;
  const sumBy = (rows, f) => rows.reduce((a, r) => a + (f(r) || 0), 0);
  const nStates = new Set(mam.map((r) => r.state)).size;

  // --- Facility-native: SBAs (#3 recruited count, #4 deployed ÷ recruited) ---
  const sbaRecruited = sumBy(mam, (r) => r.sbaRecruited);
  const sbaDeployed = sumBy(mam, (r) => r.sbaDeployed);
  put('Number of SBAs recruited', MAMII_COUNT_PCT, fmtCount(sbaRecruited), {
    n: mam.length,
    meta: `MAMII: ${fmtCount(sbaRecruited)} SBAs recruited across ${nStates} states (facility-level count; the recruitment programme is still ramping — most facilities report 0).`,
  });
  // deployed ÷ recruited. A MAMII-covered scope that has recruited 0 SBAs reads 0%
  // (nothing recruited → nothing deployed) rather than gapping to "out of scope" —
  // the sibling recruited-count card already shows 0, so 0% keeps the pair coherent.
  // (mam.length > 0 is guaranteed above, so this only ever fires inside real MAMII rows.)
  const sbaDeployedPct = ratioPct(sbaDeployed, sbaRecruited) ?? 0;
  put('Proportion of SBAs deployed per state', sbaDeployedPct, pctStr(sbaDeployedPct), {
    n: mam.length,
    meta: `MAMII: SBAs deployed (${fmtCount(sbaDeployed)}) ÷ recruited (${fmtCount(sbaRecruited)}). Recorded deployments equal recruitments in this dataset (all recruited SBAs are logged as deployed).`,
  });

  // --- State-native: CBHW workforce (dedupe to one row per state) ---
  const byState = dedupeBy(mam, (r) => r.stateKey);
  const cbhwRecruited = sumBy(byState, (r) => r.cbhwRecruited);
  const cbhwTrained = sumBy(byState, (r) => r.cbhwTrained);
  const cbhwDeployed = sumBy(byState, (r) => r.cbhwDeployed);
  const cbhwAbsorbed = sumBy(byState, (r) => r.cbhwAbsorbed);
  // #6 — defined as a proportion, but MAMII carries no planned/target denominator,
  // so it is reported as a COUNT (agreed with the data owner).
  put('Proportion of CBHWs recruited', MAMII_COUNT_PCT, `${fmtCount(cbhwRecruited)} recruited`, {
    n: byState.length,
    meta: `MAMII: ${fmtCount(cbhwRecruited)} CBHWs recruited across ${byState.length} states (state-level count). Shown as a count — the planned/target denominator the proportion needs is not in this dataset.`,
  });
  put('Number of CBHWs trained', MAMII_COUNT_PCT, fmtCount(cbhwTrained), {
    n: byState.length,
    meta: `MAMII: ${fmtCount(cbhwTrained)} CBHWs trained across ${byState.length} states (state-level count).`,
  });
  // deployed ÷ recruited (state-level). Like the SBA pair above, a scope with 0
  // recruited CBHWs reads 0% instead of gapping out of scope.
  const cbhwDeployedPct = ratioPct(cbhwDeployed, cbhwRecruited) ?? 0;
  put('Proportion of CBHWs deployed per state', cbhwDeployedPct, pctStr(cbhwDeployedPct), {
    n: byState.length,
    meta: `MAMII: CBHWs deployed (${fmtCount(cbhwDeployed)}) ÷ recruited (${fmtCount(cbhwRecruited)}), state-level.`,
  });
  // absorbed ÷ recruited. Scopes with 0 recruited read 0% rather than out of scope.
  const cbhwAbsorbedPct = ratioPct(cbhwAbsorbed, cbhwRecruited) ?? 0;
  put('% of recruited CBHWs that have been absorbed', cbhwAbsorbedPct, pctStr(cbhwAbsorbedPct), {
    n: byState.length,
    meta: `MAMII: ${fmtCount(cbhwAbsorbed)} of ${fmtCount(cbhwRecruited)} recruited CBHWs absorbed into the establishment — absorption is not yet reported in MAMII (currently 0).`,
  });

  // --- LGA-native: revitalised PHCs (dedupe to one row per LGA; skip #N/A) ---
  const byLga = dedupeBy(mam, (r) => r.lgaKey).filter((r) => r.revitalized != null);
  const revitalized = sumBy(byLga, (r) => r.revitalized);
  put('Number of revitalized PHC facilities per state', MAMII_COUNT_PCT, fmtCount(revitalized), {
    n: byLga.length,
    meta: `MAMII: ${fmtCount(revitalized)} revitalized PHCs across ${byLga.length} LGAs (LGA-level count; LGAs reporting "#N/A" are excluded).`,
  });
}

/**
 * Facility functional-status 4-way split (#30-33) from MAMII — the SOLE source the
 * indicator workbook maps for this indicator: L2/L1/Partial come from MAMII's LGA
 * columns; Non-functional is DERIVED (Total − L2 − L1 − Partial). MAMII's columns
 * are LGA-native (one true value per LGA), so rows are deduped by LGA before summing.
 * Partial (and hence Non-functional) are currently 0 — a REAL reported 0, not a gap.
 * Returns null when the (scoped) row set has no facilities. Shared by the ETL
 * (national) and the browser (scoped/per-state), so both stay in lockstep.
 */
export function mamiiFunctionalSplit(rows) {
  const byLga = dedupeBy(rows, (r) => r.lgaKey).filter((r) => r.lgaTotalBhcpf != null);
  const total = byLga.reduce((a, r) => a + (r.lgaTotalBhcpf || 0), 0);
  if (!total) return null;
  const l2c = byLga.reduce((a, r) => a + (r.l2 || 0), 0);
  const l1c = byLga.reduce((a, r) => a + (r.l1 || 0), 0);
  const partialc = byLga.reduce((a, r) => a + (r.partial || 0), 0);
  const nonfuncc = Math.max(0, total - l2c - l1c - partialc);
  return {
    l2: round((l2c / total) * 100),
    l1: round((l1c / total) * 100),
    partial: round((partialc / total) * 100),
    nonfunc: round((nonfuncc / total) * 100),
    total,
    states: new Set(byLga.map((r) => r.state)).size,
  };
}

/* ------------------------------------------------------------------ *
 * PFMO indicators (the only NATIONAL source, ~37 states). Wired strictly to the
 * indicators the workbook maps to PFMO and that PFMO can actually compute:
 *   #58 MMR, #59 U5MR  — the TRUE live-births denominator (col live_births_monthly),
 *                        resolving the old SRH/SFM facility-delivery interim range;
 *   #17 tracer-6       — facility_commodities_available carries ALL six (incl. the
 *                        ACT + Pentavalent the ODK panels lacked), so full 6/6;
 *   #27 equipment-5    — every item incl. the episiotomy set SFM/Sheet lacked → 5/5;
 *   #47 essential svcs — health_facility_services_offered (3 form vocabularies);
 *   #87 Penta3         — Penta3/Penta1 completion proxy (no eligible-child target pop).
 * Called LAST in buildIndicators so PFMO wins for these where it has data; a scope
 * PFMO doesn't cover (e.g. a facilityType filter — PFMO has no BEmONC/CEmONC type)
 * simply falls back to whatever the ODK/Sheet blocks already put (or the empty state).
 * NB #14 & #30–33 are NOT here: PFMO's staff_count_* fields are empty in the live
 * export, so its ≥4-SBA / functional-status formulas can't run — those stay MAMII.
 * ------------------------------------------------------------------ */

// The #17/#27/#47 per-facility booleans (tracer6/commReported, equip5/equipReported,
// svc6/svcReported) are pre-computed at the source (etl/sources/pfmo.mjs) and stamped
// on every record, so the engine just COUNTS them — and the shipped facts can drop the
// heavy commodity/service/equipment arrays (kept the snapshot under GitHub's file cap).
function addPfmoIndicators(pfmo, put) {
  const recs = pfmo.records || [];
  const all = pfmo.allRecords || recs; // flow fields are summed over facility-months
  if (!recs.length && !all.length) return;

  // #58 MMR / #59 U5MR — the true live-births denominator the indicator sheet specifies.
  // pct stays NEUTRAL (amber): these are facility-based rates, not colour-graded good/bad,
  // and are not yet split BHCPF vs non-BHCPF. The real figure lives in value + meta.
  const NEUTRAL_PCT = 50;
  const matDeaths = sum(all, (r) => r.maternalDeaths);
  const u5Deaths = sum(all, (r) => r.under5Deaths);
  const livebirths = sum(all, (r) => r.livebirths);
  if (livebirths) {
    const mmr = Math.round((matDeaths / livebirths) * 100000);
    put('Maternal Mortality Ratio - BHCPF vs. non-BHCPF facilities', NEUTRAL_PCT, `${mmr.toLocaleString('en-US')} / 100,000 live births`, {
      n: matDeaths,
      meta:
        `PFMO (national, ${recs.length.toLocaleString()} facilities): maternal_deaths_monthly ÷ live_births_monthly × 100,000 = ` +
        `${mmr.toLocaleString('en-US')} (${matDeaths.toLocaleString('en-US')} maternal deaths ÷ ${livebirths.toLocaleString('en-US')} live births). ` +
        `This uses the TRUE population live-births denominator the indicator sheet specifies — replacing the earlier SRH/SFM facility-delivery interim range. ` +
        `Facility-based; not yet split BHCPF vs non-BHCPF. Gross data-entry outliers are dropped at source.`,
    });
    const u5mr = round((u5Deaths / livebirths) * 1000, 1);
    put('Under-5 Mortality Rate - BHCPF vs. non-BHCPF facilities', NEUTRAL_PCT, `${u5mr} / 1,000 live births`, {
      n: u5Deaths,
      meta:
        `PFMO (national): under5_deaths_monthly ÷ live_births_monthly × 1,000 = ${u5mr} ` +
        `(${u5Deaths.toLocaleString('en-US')} under-5 deaths ÷ ${livebirths.toLocaleString('en-US')} live births). ` +
        `True live-births denominator per the sheet. Facility-recorded under-5 deaths (an institutional ratio, not a population U5MR); not split BHCPF vs non-BHCPF.`,
    });
  }

  // #87 Penta3 — the sheet's denominator is the eligible-child TARGET POPULATION,
  // which PFMO doesn't carry; Penta3/Penta1 completion is the closest available proxy.
  const penta1 = sum(all, (r) => r.penta1);
  const penta3 = sum(all, (r) => r.penta3);
  const pentaPct = ratioPct(penta3, penta1);
  put('Proportion of children &lt;1 year who received Penta 3', pentaPct, pentaPct == null ? null : `${round(pentaPct)}% (Penta3/Penta1)`, {
    n: penta3,
    info: null,
    meta:
      `PFMO (national): ${penta3.toLocaleString('en-US')} Penta3 ÷ ${penta1.toLocaleString('en-US')} Penta1 doses = ${round(pentaPct ?? 0)}% completion. ` +
      `The indicator's true denominator is the eligible-child target population, which PFMO doesn't collect, so Penta3/Penta1 completion is shown as the closest proxy (a coverage-quality/dropout signal). Raw dose counts preserved above.`,
  });

  // #17 six tracer commodities — full 6/6 (PFMO is the first source with ACT + Pentavalent).
  const commRep = recs.filter((r) => r.commReported).length;
  const tracer6 = recs.filter((r) => r.tracer6).length;
  const tracerPct = ratioPct(tracer6, commRep);
  put('Proportion of PHCs with all six tracer commodities available*', tracerPct, tracerPct == null ? null : `${round(tracerPct)}% · 6 of 6`, {
    n: commRep,
    info: null,
    meta:
      `PFMO facility_commodities_available — all six tracers: Oxytocin, MMS, ACT, Pentavalent, HIV RTKs, and ≥3 modern contraceptives. ` +
      `${tracer6.toLocaleString('en-US')} of ${commRep.toLocaleString('en-US')} facilities reporting commodities have all six. ` +
      `PFMO is the first source carrying ACT + Pentavalent, so this is the full 6/6 measure (was SRH 3/6).`,
  });

  // #27 maternal-health equipment — all five available AND functional (incl. episiotomy).
  const eqRep = recs.filter((r) => r.equipReported).length;
  const eq5 = recs.filter((r) => r.equip5).length;
  const eqPct = ratioPct(eq5, eqRep);
  put('Proportion of visited PHCs with functional maternal health equipment*', eqPct, eqPct == null ? null : `${round(eqPct)}% · 5 of 5`, {
    n: eqRep,
    info: null,
    meta:
      `PFMO (national) — all five items available AND functional: delivery bed, episiotomy/suturing set, MVA, neonatal Ambu bag, pulse oximeter. ` +
      `${eq5.toLocaleString('en-US')} of ${eqRep.toLocaleString('en-US')} facilities. PFMO carries the episiotomy set the earlier SFM/Sheet pooling lacked → full 5/5 (was 4/5).`,
  });

  // #47 essential services — all six offered (matched across three form vocabularies).
  const svcRep = recs.filter((r) => r.svcReported).length;
  const svc6 = recs.filter((r) => r.svc6).length;
  const svcPct = ratioPct(svc6, svcRep);
  put('Proportion of visited PHCs offering the full essential service package*', svcPct, svcPct == null ? null : `${round(svcPct)}%`, {
    n: svcRep,
    info: null,
    meta:
      `PFMO health_facility_services_offered — all six essential services (immunization, family planning, ANC, delivery, malaria treatment, HIV diagnosis). ` +
      `${svc6.toLocaleString('en-US')} of ${svcRep.toLocaleString('en-US')} facilities. ` +
      `Labels are normalised across PFMO's three form-version service vocabularies so no facility is dropped.`,
  });
}

/* ------------------------------------------------------------------ *
 * Indicator measurements (national point-in-time, latest per facility).
 * ------------------------------------------------------------------ */
export function buildIndicators(srh, sfm, sheet, mamii = { records: [] }, pfmo = { records: [], allRecords: [] }) {
  const s = srh.records;
  const mam = mamii.records || [];
  // States MAMII covers in THIS scope — used to give MAMII source precedence over
  // the ODK/Sheet facilities for the overlap indicators (#14), so the same physical
  // facility is never counted twice across sources.
  const mamiiStates = new Set(mam.map((r) => r.state));
  const out = {};
  const put = (name, pct, value, extra = {}) => {
    if (pct == null) return;
    out[name] = { pct: round(pct), value, ...extra };
  };

  // ANC1/ANC4: pool SRH (live-birth buckets) with SFM (direct ANC1/ANC4 visit
  // counts ÷ facility deliveries). The two sources independently agree closely
  // (ANC4 lands within 1pt of each other), which is why they're pooled rather
  // than kept single-source like the mortality indicators below.
  const lb = sum(s, (r) => r.livebirths);
  const lb0 = sum(s, (r) => r.lb0);
  const sfmAncDeliv = sum(sfm.records, (r) => r.totalDeliveries);
  const ancDen = lb + sfmAncDeliv;
  const anc1num = (lb - lb0) + sum(sfm.records, (r) => r.ancOne);
  const anc1pct = ratioPct(anc1num, ancDen);
  put('% of women with a live birth who attended ANC 1', anc1pct, anc1pct == null ? null : pctStr(anc1pct), {
    n: s.length + sfm.records.length,
    meta: 'Pools SRH (live-birth buckets, ≥1 visit ÷ live births) with SFM (direct ANC1 visit count ÷ facility deliveries).',
  });

  // ANC4 (≥4 visits): the live-birth buckets can't isolate exactly-4 visits (they're
  // pooled in the 1–4 bucket), so use (5–7 + 8+) / live births as a conservative floor.
  const anc4num = sum(s, (r) => r.lb5_7 + r.lb8plus) + sum(sfm.records, (r) => r.ancFour);
  const anc4pct = ratioPct(anc4num, ancDen);
  put('% of women with a live birth who attended ANC 4', anc4pct, anc4pct == null ? null : pctStr(anc4pct), {
    n: s.length + sfm.records.length,
    meta: 'ANC4 (≥4 visits) approximated as ≥5 on the SRH side — the survey’s 1–4 visit bucket can’t isolate exactly-4 visits. Pooled with SFM’s direct ANC4 visit count ÷ facility deliveries; both sources independently agree closely.',
  });

  // Modern contraceptive use.
  const fpTot = sum(s, (r) => r.fpTotal);
  const fpMod = sum(s, (r) => r.fpModernUnits);
  const fpPct = ratioPct(fpMod, fpTot);
  put('% of family planning clients using modern contraceptives', fpPct, fpPct == null ? null : pctStr(fpPct), { n: s.filter((r) => r.fpTotal > 0).length });

  // Facility deliveries (latest reporting month, national). Per the indicator
  // workbook, pool SRH `deliveries_total` with SFM `anc.tot_facility_deliveries` —
  // the two sources cover mostly different states, so the counts are additive (no
  // double-count). The fill-ratio colour uses the SRH side only, where the
  // `deliveries_expected` denominator exists.
  const delivSrh = sum(s, (r) => r.deliveries);
  const delivSfm = sum(sfm.records, (r) => r.deliveries);
  const deliv = delivSrh + delivSfm;
  const delivExp = sum(s, (r) => r.deliveriesExpected);
  const delivFill = ratioPct(delivSrh, delivExp);
  put('Number of deliveries in facilities', delivFill ?? 60, deliv.toLocaleString('en-US'), {
    n: s.length + sfm.records.length,
    count: deliv,
    meta: 'Facility deliveries pooled across SRH ODK (deliveries_total) and SFM (anc.tot_facility_deliveries), per the indicator workbook. The two panels cover mostly different states, so the counts add without double-counting.',
  });

  // #97 Proportion of deliveries by skilled birth attendance — SFM ONLY. SRH ODK's
  // "SBA" fields are staffing counts (SBAs posted to/working at the facility), not
  // an attended-delivery count — verified via the form's question labels, so there
  // is no valid SRH numerator. SFM has a real per-facility field for this.
  const sbaDelivDen = sum(sfm.records, (r) => r.deliveries);
  const sbaAttendedPct = ratioPct(sum(sfm.records, (r) => r.sbaAttendedDeliveries), sbaDelivDen);
  put('Proportion of deliveries attended by a skilled birth attendant', sbaAttendedPct, sbaAttendedPct == null ? null : pctStr(sbaAttendedPct), {
    n: sfm.records.length,
    meta: 'SFM ODK only: deliveries attended by a skilled birth attendant ÷ total facility deliveries. SRH ODK has no equivalent field — its "SBA" questions are staffing counts, not attended-delivery counts. Near-ceiling: in the latest submission per facility, 374 of 382 facilities report the two counts as identical.',
  });

  // Maternal death cause shares (inverse indicators). Deaths are RARE CUMULATIVE
  // events, so these sum over ALL submissions/periods (not latest-per-facility).
  // SOURCE = SFM ODK ONLY: SFM's panel carries 742 maternal deaths — an adequate
  // denominator for a cause breakdown — while SRH alone has just 10 (any proportion
  // off n=10 is statistical noise: its CI on "1/10" spans ~0–45%). The updated
  // workbook maps the SFM cause fields for exactly this reason. A cause SHARE is a
  // denominator-independent proportion, so it's reported from the panel with the
  // adequate n even though the maternal-mortality LEVEL (#58) can't be pooled — see
  // the #58 note below. SRH's 10 deaths are intentionally NOT folded in (they'd add
  // nothing statistically and muddy the provenance).
  const all = srh.allRecords;
  const allSfm = sfm.allRecords;
  const srhDeaths = sum(all, (r) => r.matDeaths);   // 10 — SRH-only, used by #58 MMR
  const sfmDeaths = sum(allSfm, (r) => r.matDeaths); // 742 — the cause-breakdown denominator
  const causeMeta =
    `Source: SFM ODK (${sfmDeaths} maternal deaths) — the panel with an adequate denominator for a cause breakdown. ` +
    `SRH ODK records only ${srhDeaths} maternal deaths, far too few to report a cause proportion, so it is not used here. ` +
    `Denominator = total maternal deaths. Cause shares are comparable across panels even though the maternal-mortality ` +
    `level (#58) is not — SFM's facility rate runs ~8× SRH's, a definitional/scope gap.`;
  const pph = ratioPct(sum(allSfm, (r) => r.matPPH), sfmDeaths);
  put('Proportion of maternal deaths resulting from PPH', pph, pph == null ? null : pctStr(pph), { n: sfmDeaths, meta: causeMeta });
  const htn = ratioPct(sum(allSfm, (r) => r.matHTN), sfmDeaths);
  put('Proportion of maternal deaths resulting from pre-eclampsia/eclampsia', htn, htn == null ? null : pctStr(htn), { n: sfmDeaths, meta: causeMeta });
  const sepsis = ratioPct(sum(allSfm, (r) => r.matSepsis), sfmDeaths);
  put('Proportion of maternal deaths resulting from sepsis', sepsis, sepsis == null ? null : pctStr(sepsis), { n: sfmDeaths, meta: causeMeta });

  // #58 MMR — wired EXACTLY as the workbook maps them: the denominator is
  // `deliveries_total` (facility deliveries), not population live births. SRH-only
  // and NOT pooled with SFM — SFM's own `mds` field sums to a national rate ~8x
  // higher (345/100k vs 44/100k here) despite the U5MR/ANC cross-checks agreeing
  // closely, so the two sources are almost certainly measuring different concepts
  // (period scope, register-audit totals, etc.). Averaging them would silently
  // fabricate a number, not improve one — flagged in meta for NPHCDA to reconcile.
  const allDeliv = sum(all, (r) => r.deliveries);
  if (allDeliv) {
    // pct is fixed at the NEUTRAL midpoint (→ amber) on purpose: these are fragile,
    // small-n, facility-based rates that shouldn't be colour-graded good/bad. The real
    // figure lives in the value string + meta.
    const NEUTRAL_PCT = 50;
    // #58 maps BOTH SRH ODK (maternal_death_total ÷ deliveries_total) and SFM
    // (mds ÷ total_facility_deliveries). The two disagree ~8× because they carry
    // OPPOSITE biases, so we present a RANGE rather than a false-precision point:
    //   • SRH (≈44) is a MATCHED cohort (deaths & deliveries from the same routine
    //     returns) but rests on only ~10 deaths and routine tools under-report
    //     maternal deaths → likely a FLOOR;
    //   • SFM (≈343) is well-powered (742 deaths) but its death audit sweeps in
    //     unbooked/pre-delivery/referred-in deaths NOT matched to its facility-delivery
    //     denominator → likely a CEILING.
    // Neither is a pooled average (that would fabricate a level); pct stays neutral.
    const srhMmr = Math.round((srhDeaths / allDeliv) * 100000);
    const sfmFacDeliv = sum(sfm.allRecords, (r) => r.totalFacilityDeliveries);
    const sfmMmr = sfmFacDeliv ? Math.round((sfmDeaths / sfmFacDeliv) * 100000) : null;
    const lo = sfmMmr == null ? srhMmr : Math.min(srhMmr, sfmMmr);
    const hi = sfmMmr == null ? srhMmr : Math.max(srhMmr, sfmMmr);
    put(
      'Maternal Mortality Ratio - BHCPF vs. non-BHCPF facilities',
      NEUTRAL_PCT,
      sfmMmr == null
        ? `${srhMmr.toLocaleString('en-US')} / 100,000 facility deliveries`
        : `${lo.toLocaleString('en-US')}–${hi.toLocaleString('en-US')} / 100,000 facility deliveries`,
      {
        n: srhDeaths + sfmDeaths,
        meta:
          `INTERIM — a true MMR needs PFMO's population live-births denominator (col O: maternal_deaths_monthly ÷ live_births_monthly), which is not yet connected; revisit once PFMO access is granted. ` +
          `Until then, shown as a range across the two workbook-mapped ODK sources, which bracket the facility MMR from opposite biases (no pooled average — that would fabricate a level). ` +
          `SRH ODK = ${srhMmr.toLocaleString('en-US')}/100k (matched cohort: maternal_death_total ÷ deliveries_total, but only ${srhDeaths} deaths, and routine tools under-report maternal deaths → likely a floor). ` +
          (sfmMmr == null
            ? `SFM ODK = not available in this scope (no SFM facility-delivery denominator here). `
            : `SFM ODK = ${sfmMmr.toLocaleString('en-US')}/100k (mds ÷ total_facility_deliveries; ${sfmDeaths} deaths — well-powered, but its death audit counts unbooked/pre-delivery/referred-in deaths not matched to the delivery denominator → likely a ceiling). `) +
          `The indicator sheet specifies a LIVE-BIRTHS denominator; both ODK sources substitute facility deliveries as an interim proxy (ODK has no clean live-births count). PFMO col O supplies the true live-births denominator (maternal_deaths_monthly ÷ live_births_monthly). Not split BHCPF vs non-BHCPF.`,
      }
    );
  }

  // #59 U5MR — SRH ODK ONLY, matching the workbook exactly: row #59 maps only
  // SRH-ODK (`neonatal_death_total ÷ deliveries_total`) and explicitly marks SFM (and
  // the Sheet) "not collected". SFM does carry a neonatal-deaths field that agrees
  // closely (SRH 5.09 vs SFM 5.54 /1,000), but we defer to the deliberate mapping and
  // don't pool it — SRH alone is adequately powered here (116 deaths, unlike the n=10
  // maternal-death count). Flagged to the mapping owner; re-add SFM only if confirmed.
  const neoDeaths = sum(all, (r) => r.neonatalDeaths);
  if (allDeliv) {
    const NEUTRAL_PCT = 50;
    const u5mr = round((neoDeaths / allDeliv) * 1000, 2);
    put(
      'Under-5 Mortality Rate - BHCPF vs. non-BHCPF facilities',
      NEUTRAL_PCT,
      `${u5mr} / 1,000 facility deliveries`,
      {
        n: neoDeaths,
        meta: 'INTERIM — a true rate needs PFMO\'s population live-births denominator (col O: under5_deaths_monthly ÷ live_births_monthly), not yet connected; revisit once PFMO access is granted. Until then: SRH ODK only (per workbook row #59) = neonatal_death_total ÷ deliveries_total × 1,000, a neonatal proxy for U5MR. Two proxies stand in for the sheet\'s definition: neonatal deaths for under-5 deaths, and facility deliveries for the live-births denominator the sheet specifies (PFMO col O supplies the true under5_deaths_monthly ÷ live_births_monthly). The workbook marks SFM & the Sheet "not collected" for #59, so SFM is not pooled in (its neonatal field agrees closely — 5.54 vs 5.09 — and could be added if the mapping owner confirms it). Small n; not split BHCPF vs non-BHCPF.',
      }
    );
  }

  // #71 % increase in FP utilization — fp_total, baseline (earliest) vs current
  // (latest) monthly value. Monthly comparison avoids the incomplete-quarter bias.
  const fpByMonthTotal = byMonth(all, (rows) => sum(rows, (r) => r.fpTotal));
  const fpMonths = MONTH_LABELS.filter((m) => fpByMonthTotal[m] > 0);
  if (fpMonths.length >= 2) {
    const base = fpByMonthTotal[fpMonths[0]];
    const cur = fpByMonthTotal[fpMonths[fpMonths.length - 1]];
    if (base) {
      const inc = ((cur - base) / base) * 100;
      put('% increase in utilization of FP services', clampPct(50 + inc), `${inc >= 0 ? '+' : ''}${round(inc)}%`, {
        n: cur,
        meta: `Change in FP clients ${fpMonths[0]} → ${fpMonths[fpMonths.length - 1]} (monthly baseline vs current).`,
      });
    }
  }

  // #36 Insurance linkage — INTENTIONALLY NOT EMITTED. It is not one of the 41
  // prioritized indicators (no card renders it), so the measurement is dropped to
  // keep the snapshot aligned to the priority set. The SRH ODK fields
  // (women_enrolled_month / insured_srh_clients) remain parsed should it return.

  // BHCPF quarterly disbursement (#48) — bhcpf_received=yes / facilities responding.
  const bhcpfResp = s.filter((r) => r.bhcpfResponded).length;
  const bhcpf = ratioPct(s.filter((r) => r.bhcpfReceived).length, bhcpfResp);
  // Timeliness refinement from the newly-mapped `bhcpf_on_time` column: of the
  // facilities that DID receive, what share received on time. Enriches #48's meta
  // (the workbook groups on_time under #48 — there is no separate on-time indicator).
  const recipients = s.filter((r) => r.bhcpfReceived).length;
  const onTime = ratioPct(s.filter((r) => r.bhcpfReceived && r.bhcpfOnTime).length, recipients);
  put('Proportion of BHCPF facilities that received their quarterly disbursement', bhcpf, bhcpf == null ? null : pctStr(bhcpf), {
    n: bhcpfResp,
    meta:
      onTime == null
        ? undefined
        : `Received = "yes" ÷ facilities responding. Of the ${recipients} facilities that received, ${pctStr(onTime)} received on time (bhcpf_on_time).`,
  });

  // #49 Total BHCPF funds received vs. expected. The definition wants an AMOUNT ratio
  // (₦ received ÷ ₦ expected), but SRH ODK has NO expected-amount field — and expected
  // can't be derived either (received amounts span ₦15–₦10m with no standard allocation).
  // So instead of a bare "%", which reads like a fund ratio, we HEADLINE the real figure
  // we actually have — total ₦ received — and put the facility-level completeness proxies
  // (received / received-in-full / on-time) in the meta. The ring shows the full-amount share.
  const bhcpfFull = ratioPct(s.filter((r) => r.bhcpfFullAmount).length, bhcpfResp);
  const totalRecv = sum(s, (r) => r.bhcpfAmount);
  const naira = fmtNaira(totalRecv);
  // Count facilities with an actual positive amount — the same "received funds"
  // definition the deep-dive filter uses, so the headline count and the table agree.
  const fundedFacilities = s.filter((r) => r.bhcpfAmount > 0).length;
  put('Total BHCPF funds received vs. expected', bhcpfFull, `${naira} received`, {
    n: bhcpfResp,
    meta:
      `Received: ${naira} across ${fundedFacilities} facilities this period (as reported). ` +
      `The expected amount is not collected in this dataset, so the received ÷ expected ratio can't be computed yet — it will be added when PFMO supplies the expected side.`,
  });

  // PPH bundle availability (SRH comm_status + SFM always_in_stock, both harmonised
  // to a strict "available" — see the source adapters).
  const pphFacs = [...s, ...sfm.records];
  const pphAvail = ratioPct(pphFacs.filter((r) => r.pphBundleAvailable).length, pphFacs.length);
  put('Proportion of facilities with the PPH bundle available*', pphAvail, pphAvail == null ? null : pctStr(pphAvail), {
    n: pphFacs.length,
    info: null, // show the real value rather than the illustrative composite breakdown
    meta: 'All 5 PPH-bundle commodities available: SRH comm_status = "available" or SFM = "always_in_stock" (strict — "sometimes in stock" excluded). Pools SRH + SFM facilities.',
  });

  // Tracer-6 PARTIAL (#17) — SRH only measures 3 of the 6 (Oxytocin, HIV RTKs, ≥3 modern
  // contraceptives). MMS is SFM-only (different panel) and ACT/Pentavalent aren't collected,
  // so this is reported as "partial (3 of 6)". `info: null` renders a plain value card
  // instead of the 6-item composite breakdown (which we can't fully populate).
  const tracer = ratioPct(s.filter((r) => r.tracerPartialAvailable).length, s.length);
  put('Proportion of PHCs with all six tracer commodities available*', tracer, tracer == null ? null : `${round(tracer)}% · 3 of 6`, {
    n: s.length,
    info: null,
    meta: 'PARTIAL (3 of 6): % of SRH PHCs with Oxytocin + HIV test kits + ≥3 modern contraceptives available. MMS is collected only in SFM (different facility panel); ACT & Pentavalent are not collected in any source.',
  });

  // Cold chain (#26) — SFM `drugs_supply.equipment.cce` = `yes` (strict; excludes
  // yes_no_therm / yes_faulty). Only facilities that answered the question count.
  const cceFacs = sfm.records.filter((r) => r.cceAssessed);
  const cce = ratioPct(cceFacs.filter((r) => r.cceFunctional).length, cceFacs.length);
  put('Proportion of wards / main PHCs with functional cold-chain equipment (SDD/CCE)', cce, cce == null ? null : pctStr(cce), {
    n: cceFacs.length,
    meta: 'Functional = SFM cold-chain equipment reported `yes` (working, with thermometer). "Present but no thermometer" and "faulty" are excluded, per cold-chain integrity standards.',
  });

  // Maternal health equipment PARTIAL (#27) — covers 4 of the 5 workbook items,
  // split across two facility panels with no join between them: SFM (neonatal Ambu
  // bag, pulse oximeter — `always_in_stock` strict) and the Sheet (delivery bed, MVA
  // kit — `available_and_functional` strict). Pooled like #14 SBA: each facility is
  // scored against the item(s) its own panel collects. Episiotomy/suturing set has
  // no source anywhere (PFMO-only, not connected) — "partial 4 of 5".
  const equipFacs = [
    ...sfm.records.map((r) => r.neoAmbuFunctional && r.oximeterFunctional),
    ...sheet.records.map((r) => r.deliveryBedFunctional && r.mvaFunctional),
  ];
  const equipPct = ratioPct(equipFacs.filter(Boolean).length, equipFacs.length);
  put('Proportion of visited PHCs with functional maternal health equipment*', equipPct, equipPct == null ? null : `${round(equipPct)}% · 4 of 5`, {
    n: equipFacs.length,
    info: null,
    meta: 'PARTIAL (4 of 5): SFM (neonatal Ambu bag + pulse oximeter, both `always_in_stock`) pooled with the SRH Sheet (delivery bed + MVA kit, both `available_and_functional`) — different facility panels, each scored against the item(s) it collects. Episiotomy/suturing set has no source (PFMO-only; PFMO not connected).',
  });

  // Facilities with ≥4 SBAs available. Per the indicator workbook, the SBA-availability
  // count is mapped to MAMII ("Total number of SBAs") and the SRH Sheet ("Total
  // Availability Count of SBAs"), with MAMII taking PRECEDENCE per state (33 states);
  // the Sheet fills only states MAMII does not cover (e.g. Ekiti), so a physical facility
  // is never double-counted. SRH ODK's "How many SBAs are working" staffing count and
  // SFM's `sbas_trained_by_sfm_still_here` are NOT mapped for #14, so both are excluded.
  const sbaFacs = [
    ...mam.filter((r) => r.sbaAssessed).map((r) => r.minFourSbas),
    ...sheet.records.filter((r) => r.sbaAssessed && !mamiiStates.has(r.state)).map((r) => r.minFourSbas),
  ];
  const sbaPct = ratioPct(sbaFacs.filter(Boolean).length, sbaFacs.length);
  put('Proportion of facilities with a minimum of 4 SBAs', sbaPct, sbaPct == null ? null : pctStr(sbaPct), {
    n: sbaFacs.length,
    meta: mam.length
      ? `MAMII "Total number of SBAs" ≥ 4 (33 states) pooled with the SRH Sheet SBA-availability count for the states MAMII does not cover, per the indicator workbook (MAMII + SRH Sheet). MAMII takes precedence per state so no facility is double-counted.`
      : undefined,
  });

  // MAMII aggregate indicators (#3/#4/#6/#7/#9/#10/#34).
  addMamiiIndicators(mam, put);

  // PFMO indicators (#58/#59/#17/#27/#47/#87). Called last so PFMO — the only national
  // source — wins for these where it has data; out-of-scope PFMO leaves the ODK/Sheet
  // values above (or the empty state) untouched. See addPfmoIndicators above.
  addPfmoIndicators(pfmo, put);

  // NOTE: #71 (% increase in FP utilization) is emitted on a MONTHLY baseline
  // (earliest→latest month) rather than quarter-over-quarter — the QoQ form was
  // data-unsafe (the incomplete latest quarter produced a spurious ~-34%). #58 (MMR)
  // is emitted SRH-only with a fixed neutral pct and caveat meta (facility-based,
  // small n, no BHCPF split) — NOT pooled with SFM's ~8× level. See docs/DATA_INTEGRATION.md.

  return out;
}
