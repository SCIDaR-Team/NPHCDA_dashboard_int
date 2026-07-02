/**
 * Transform layer: fold the per-source records into the exact shapes the app's
 * DataSource serves — keyed by the PRESERVED indicator names in
 * src/data/mock/indicators.ts. Anything we can't compute is simply left out and
 * the SnapshotDataSource renders it as the "Data not yet available" empty state.
 */
import { ratioPct, clampPct, round, alignToMonthFrame, MONTH_LABELS } from './lib/util.mjs';

const sum = (arr, f) => arr.reduce((a, r) => a + f(r), 0);
const pctStr = (p) => `${round(p)}%`;

/* ------------------------------------------------------------------ *
 * Indicator measurements (national point-in-time, latest per facility).
 * ------------------------------------------------------------------ */
function buildIndicators(srh, sfm, sheet) {
  const s = srh.records;
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

  // Facility deliveries (latest reporting month, national).
  const deliv = sum(s, (r) => r.deliveries);
  const delivExp = sum(s, (r) => r.deliveriesExpected);
  const delivFill = ratioPct(deliv, delivExp);
  put('Number of deliveries in facilities', delivFill ?? 60, deliv.toLocaleString('en-US'), { n: s.length, count: deliv });

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
          `SFM ODK = ${sfmMmr.toLocaleString('en-US')}/100k (mds ÷ total_facility_deliveries; ${sfmDeaths} deaths — well-powered, but its death audit counts unbooked/pre-delivery/referred-in deaths not matched to the delivery denominator → likely a ceiling). ` +
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

  // Insurance linkage.
  const enrolled = sum(s, (r) => r.womenEnrolled);
  const insured = ratioPct(sum(s, (r) => r.insuredClients), enrolled);
  put('% of enrolled women linked to health insurance or financial protection schemes', insured, insured == null ? null : pctStr(insured), { n: enrolled });

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
  const fullCount = s.filter((r) => r.bhcpfFullAmount).length;
  const totalRecv = sum(s, (r) => r.bhcpfAmount);
  const naira = totalRecv >= 1e9 ? `₦${round(totalRecv / 1e9, 2)}bn` : `₦${round(totalRecv / 1e6, 1)}m`;
  put('Total BHCPF funds received vs. expected', bhcpfFull, `${naira} received`, {
    n: bhcpfResp,
    meta:
      `Received: ${naira} across ${recipients} facilities this period (as reported). ` +
      `Expected: not available in this dataset — the BHCPF module records only amounts received, with no expected-amount field, so the received ÷ expected ratio can't be computed (PFMO would supply the expected side). ` +
      `Facility completeness instead: ${bhcpf == null ? '—' : pctStr(bhcpf)} received any disbursement; ${bhcpfFull == null ? '—' : pctStr(bhcpfFull)} received their FULL expected amount (${fullCount}/${bhcpfResp})` +
      `${onTime == null ? '' : `; ${pctStr(onTime)} of recipients on time`}. Ring = full-amount share.`,
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

  // Facilities with ≥4 SBAs available. Pool the two TRUE availability counts:
  //   - SRH ODK  "How many SBAs are currently working at this facility"
  //   - Sheet    "Total Availability Count of SBAs (BEmONC/CEmONC)"
  // SFM's `sbas_trained_by_sfm_still_here` is deliberately excluded — it counts
  // only SFM-trained SBAs still present, not total SBA availability.
  const sbaFacs = [
    ...s.map((r) => r.sbaCount >= 4),
    ...sheet.records.filter((r) => r.sbaAssessed).map((r) => r.minFourSbas),
  ];
  const sbaPct = ratioPct(sbaFacs.filter(Boolean).length, sbaFacs.length);
  put('Proportion of facilities with a minimum of 4 SBAs', sbaPct, sbaPct == null ? null : pctStr(sbaPct), { n: sbaFacs.length });

  // NOTE: #71 (% increase in FP utilization) is emitted on a MONTHLY baseline
  // (earliest→latest month) rather than quarter-over-quarter — the QoQ form was
  // data-unsafe (the incomplete latest quarter produced a spurious ~-34%). #58 (MMR)
  // is emitted SRH-only with a fixed neutral pct and caveat meta (facility-based,
  // small n, no BHCPF split) — NOT pooled with SFM's ~8× level. See docs/DATA_INTEGRATION.md.

  return out;
}

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
          value: val('Number of deliveries in facilities'),
          ...deltaOf(deliverTrend),
          target: 'Rising utilization of facility-based care',
          spark: sparkOf(deliverTrend),
          pct: pct('Number of deliveries in facilities', 60),
          inverse: false,
        },
        {
          label: 'ANC1 coverage',
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

function buildTrends(srh, sfm) {
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
      lga: r.lga,
      ward: r.lga,
      facility: r.facility,
      type: /secondary|tert/i.test(String(r.designation)) ? 'CEmONC' : 'BEmONC',
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
      lga: r.lga,
      ward: r.lga,
      facility: r.facility,
      type: /cemonc/i.test(String(r.facilityType)) ? 'CEmONC' : 'BEmONC',
      status: r.sbaCount >= 4 ? 'L2' : r.sbaCount >= 1 ? 'L1' : 'Partial',
      tracer: round(r.commAvailableCount ?? 0),
      satisfaction: 0,
      penta3: 0,
      maternalDeaths: 0,
    });
  }
  return [...byKey.values()];
}

export function transform({ srh, sfm, sheet }) {
  const indicators = buildIndicators(srh, sfm, sheet);
  const trends = buildTrends(srh, sfm);
  const kpis = buildKpis(indicators, trends);
  const stateScores = buildStateScores(srh, sfm);
  const facilities = buildFacilities(srh, sfm, sheet);
  return { indicators, kpis, trends, stateScores, facilities, sheet };
}
