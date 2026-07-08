/**
 * SRH ODK adapter — the monthly SRH Routine tool (project 1239).
 *
 * Fetches all submissions, then reduces to the LATEST submission per facility
 * (point-in-time snapshot) and flattens the nested ODK payload into flat,
 * source-agnostic records the transform layer maps onto indicator names.
 */
import { fetchAllOData } from '../lib/odata.mjs';
import { dig, num, collectCommStatus, isAvailable, toQuarter, toMonthLabel, isFutureReport } from '../lib/util.mjs';
import { normState, titleCase, cleanName, zoneForState, donorsForState } from '../lib/states.mjs';

const SERVICE_URL = 'https://odk.mine.bz/v1/projects/1239/forms/SRH%20Routine%20tool.svc';

const P = {
  anc1: 'group_ie83b74.delivery.group_anc.anc1_total',
  anc4: 'group_ie83b74.delivery.group_anc.anc4_total',
  deliveries: 'group_ie83b74.delivery.group_vx96d07.deliveries_total',
  deliveriesExpected: 'group_ie83b74.delivery.group_vx96d07.deliveries_expected',
  cesarean: 'group_ie83b74.delivery.group_vx96d07.cesarean_deliveries',
  lb0: 'group_ie83b74.delivery.group_vx96d07.group_im1pj48.anc_livebirth_0',
  lb1_4: 'group_ie83b74.delivery.group_vx96d07.group_im1pj48.anc_livebirth_1_4',
  lb5_7: 'group_ie83b74.delivery.group_vx96d07.group_im1pj48.anc_livebirth_5_7',
  lb8: 'group_ie83b74.delivery.group_vx96d07.group_im1pj48.anc_livebirth_8plus',
  fpTotal: 'group_ie83b74.fp.fp_total',
  matDeaths: 'group_ie83b74.delivery.group_qn3kk23.maternal_death_total',
  matPPH: 'group_ie83b74.delivery.group_qn3kk23.maternal_causes.mat_hemorrhage',
  matHTN: 'group_ie83b74.delivery.group_qn3kk23.maternal_causes.mat_htn',
  matSepsis: 'group_ie83b74.delivery.group_qn3kk23.maternal_causes.mat_sepsis',
  neonatalDeaths: 'group_ie83b74.group_gq4ec12.neonatal_death_total',
  womenEnrolled: 'group_da6ne51.women_enrolled_month',
  insuredClients: 'group_da6ne51.insured_srh_clients',
  sbaCount: 'group_fu7yt17.How_many_SBAs_are_cu_ing_at_this_facility',
  bhcpfReceived: 'group_bhcpf.bhcpf_received',
  bhcpfFullAmount: 'group_bhcpf.bhcpf_full_amount',
  bhcpfOnTime: 'group_bhcpf.bhcpf_on_time',
  bhcpfAmount: 'group_bhcpf.bhcpf_amount',
};

// Modern contraceptive method fields — EXACTLY the six the mapping workbook lists
// for indicator #67 (condoms are intentionally excluded per the workbook).
const FP_MODERN = [
  'Oral_contraceptives',
  'Intra_Uterine_Contraceptive_Device_IUCD',
  'Injectable_contraceptives_sa',
  'Injectable_contraceptives_fa',
  'Implants',
  'Emergency_contraceptives',
];

// PPH bundle drug slugs as they appear in comm_status_<slug>.
const PPH_BUNDLE = [
  'Oxytocin_injection',
  'Misoprostol_tablet',
  'Carbetocin__Heat_Stable_Carbetocin',
  'Calibrated_drapes',
  'Tranexamic_Acid_TXA',
];

// Modern-contraceptive comm_status slugs for the tracer "≥3 modern contraceptives"
// sub-item (workbook lists these five for the contraceptive component of #17).
const TRACER_CONTRA = [
  'Injectable_contraceptives',
  'Implants',
  'Intra_Uterine_Contraceptive_Device_IUCD',
  'Oral_contraceptives',
  'Emergency_contraceptive_pills',
];

function reportingPeriod(row) {
  const y = dig(row, 'Select_the_year_for_a_is_being_collected') ?? row.current_year;
  const m = dig(row, 'Select_the_month_for_ta_is_being_reported') ?? row.current_month_num;
  // Drop data-entry typos in the reporting date that land in the future (e.g. a form
  // submitted in 2026 but stamped "May 2027") so they can't pollute the period range,
  // the trend frame, or the FP-increase baseline. The record still counts point-in-time.
  if (isFutureReport(y, m)) return { quarter: null, month: null };
  return { quarter: toQuarter(y, m), month: toMonthLabel(y, m) };
}

function flatten(row) {
  const comm = collectCommStatus(row);
  const modern = dig(row, 'group_ie83b74.fp.group_ns6us35') ?? {};
  const modernUnits = FP_MODERN.reduce((sum, k) => sum + num(modern[k]), 0);
  const livebirths = num(dig(row, P.lb0)) + num(dig(row, P.lb1_4)) + num(dig(row, P.lb5_7)) + num(dig(row, P.lb8));
  const state = normState(row.STATE);

  return {
    state,
    // Derived filter dimensions (deterministic from state; see lib/states.mjs).
    zone: zoneForState(state),
    donor: donorsForState(state),
    lga: titleCase(row.LGA),
    facility: cleanName(row.facility_name) || 'Unknown facility',
    facilityType: row.facility_type || null, // BEmONC / CEmONC
    quarter: reportingPeriod(row).quarter,
    month: reportingPeriod(row).month,
    submittedAt: row.end || row.start || null,

    anc1: num(dig(row, P.anc1)),
    anc4: num(dig(row, P.anc4)),
    deliveries: num(dig(row, P.deliveries)),
    deliveriesExpected: num(dig(row, P.deliveriesExpected)),
    cesarean: num(dig(row, P.cesarean)),
    livebirths,
    lb0: num(dig(row, P.lb0)),
    // ANC4 (#103, ≥4 visits) = (5–7 + 8+) / live births — conservative floor, since
    // the 1–4 bucket can't isolate exactly-4 visits (see docs/DATA_INTEGRATION.md).
    lb5_7: num(dig(row, P.lb5_7)),
    lb8plus: num(dig(row, P.lb8)),

    fpTotal: num(dig(row, P.fpTotal)),
    fpModernUnits: modernUnits,

    matDeaths: num(dig(row, P.matDeaths)),
    matPPH: num(dig(row, P.matPPH)),
    matHTN: num(dig(row, P.matHTN)),
    matSepsis: num(dig(row, P.matSepsis)),
    neonatalDeaths: num(dig(row, P.neonatalDeaths)),

    womenEnrolled: num(dig(row, P.womenEnrolled)),
    insuredClients: num(dig(row, P.insuredClients)),
    sbaCount: num(dig(row, P.sbaCount)),

    // BHCPF quarterly disbursement (#48): yes/no from all responding facilities.
    bhcpfResponded: ['yes', 'no'].includes(String(dig(row, P.bhcpfReceived)).trim().toLowerCase()),
    bhcpfReceived: String(dig(row, P.bhcpfReceived)).trim().toLowerCase() === 'yes',
    // BHCPF full expected amount received (#49 proxy) + amount received (₦).
    bhcpfFullAmount: String(dig(row, P.bhcpfFullAmount)).trim().toLowerCase() === 'yes',
    // Disbursement received ON TIME (#48 timeliness refinement — newly mapped column).
    // Only asked of facilities that received; enriches #48's meta, not a separate indicator.
    bhcpfOnTime: String(dig(row, P.bhcpfOnTime)).trim().toLowerCase() === 'yes',
    bhcpfAmount: num(dig(row, P.bhcpfAmount)),

    // PPH bundle available iff every component reads "available".
    pphBundleAvailable: PPH_BUNDLE.every((slug) => isAvailable(comm[slug])),
    commAvailableCount: Object.values(comm).filter(isAvailable).length,

    // Tracer-6 PARTIAL (#17): the 3 tracer items SRH collects — Oxytocin, HIV RTKs,
    // and ≥3 modern contraceptives. (MMS is SFM-only/different panel; ACT & Pentavalent
    // are not collected anywhere.)
    tracerPartialAvailable:
      isAvailable(comm['Oxytocin_injection']) &&
      isAvailable(comm['HIV_test_kits']) &&
      TRACER_CONTRA.filter((slug) => isAvailable(comm[slug])).length >= 3,
  };
}

/** Reduce to the most recent submission per facility (state|lga|facility key). */
function latestPerFacility(records) {
  const byKey = new Map();
  for (const r of records) {
    if (!r.state) continue; // drop rows we can't place on the map
    const key = `${r.state}|${r.lga}|${r.facility}`;
    const prev = byKey.get(key);
    if (!prev || String(r.submittedAt) > String(prev.submittedAt)) byKey.set(key, r);
  }
  return [...byKey.values()];
}

export async function loadSrhOdk(credentials) {
  const { rows, total } = await fetchAllOData(SERVICE_URL, 'Submissions', credentials);
  const flat = rows.map(flatten);
  const snapshot = latestPerFacility(flat);
  return {
    name: 'SRH ODK',
    ok: true,
    rowsFetched: total,
    facilities: snapshot.length,
    quarters: [...new Set(flat.map((r) => r.quarter).filter(Boolean))].sort(),
    records: snapshot,
    allRecords: flat, // kept for trend (period) aggregation
  };
}
