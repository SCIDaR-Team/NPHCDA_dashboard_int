/**
 * SFM ODK adapter — HSDF consortium facility monitoring tool (project 381).
 * One `Submissions` entity; fields live under Facility_demographics / staff_training /
 * anc / drugs_supply. Reduced to the latest submission per facility.
 */
import { fetchAllOData } from '../lib/odata.mjs';
import { dig, num, numPos, toQuarter, toMonthLabel, isFutureReport } from '../lib/util.mjs';
import { normState, titleCase, cleanName, zoneForState, donorsForState } from '../lib/states.mjs';
import { sanitizeRecords } from '../lib/quality.mjs';

const SERVICE_URL =
  'https://odk.mine.bz/v1/projects/381/forms/hsdf_consortium_facility_monitoring_tool_v1.svc';

// PPH-bundle stock-status fields (Multiple Choice: always/sometimes/never_in_stock).
// These are the correct availability fields (NOT the *_procurement_source dropdowns).
const PPH_BUNDLE_SFM = [
  'drugs_supply.drugs.oxytocin',
  'drugs_supply.drugs.misoprostol',
  'drugs_supply.drugs.hsc',
  'drugs_supply.drugs.txa',
  'drugs_supply.supplies.calibrated_drapes',
];

// Harmonisation with SRH's binary "available": only `always_in_stock` counts as
// available (strict). `sometimes_in_stock` and `never_in_stock` ⇒ not available.
const inStock = (v) => String(v).trim().toLowerCase() === 'always_in_stock';

function reportingPeriod(row) {
  const raw =
    dig(row, 'Facility_demographics.data_collection_month_year') ||
    dig(row, 'Facility_demographics.date_of_assessment');
  if (!raw) return { quarter: null, month: null };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { quarter: null, month: null };
  // Drop future-dated reporting typos so they can't pollute the period range or trends.
  if (isFutureReport(d.getFullYear(), d.getMonth() + 1)) return { quarter: null, month: null };
  return {
    quarter: toQuarter(d.getFullYear(), d.getMonth() + 1),
    month: toMonthLabel(d.getFullYear(), d.getMonth() + 1),
  };
}

// Maternal-death cause groups (#60/#61/#62), summed from the SFM sub-fields the
// updated workbook maps. numPos clamps the -99 "not applicable" sentinels this
// panel uses so they don't net against real counts.
const MD = 'mortality_data.maternal_deaths.';
const causeSum = (row, keys) => keys.reduce((a, k) => a + numPos(dig(row, MD + k)), 0);
const MD_PPH = ['md_svd_pph', 'md_avd_pph', 'md_cs_pph'];
const MD_PEE = ['pee_pre_delivery', 'md_pee_vag', 'md_pee_cs'];
const MD_SEPSIS = ['sepsis_pre_delivery', 'md_sepsis_vag', 'md_sepsis_cs'];

function flatten(row) {
  const sbas = num(dig(row, 'staff_training.sbas_trained_by_sfm_still_here'));
  const pphStocked = PPH_BUNDLE_SFM.every((p) => inStock(dig(row, p)));
  // Cold chain (#26): functional = `yes` only (strict). `yes_no_therm` (no thermometer)
  // and `yes_faulty` are NOT counted as functional; `no` = absent.
  const cceRaw = String(dig(row, 'drugs_supply.equipment.cce')).trim().toLowerCase();
  const state = normState(dig(row, 'Facility_demographics.state'));
  return {
    state,
    // Derived filter dimensions (deterministic from state; see lib/states.mjs).
    zone: zoneForState(state),
    donor: donorsForState(state),
    lga: titleCase(dig(row, 'Facility_demographics.lga_selected')),
    facility: cleanName(titleCase(dig(row, 'Facility_demographics.facility_name'))) || 'Unknown facility',
    designation: dig(row, 'Facility_demographics.facility_designation_auto') || null,
    quarter: reportingPeriod(row).quarter,
    month: reportingPeriod(row).month,
    submittedAt: dig(row, 'Facility_demographics.date_of_assessment') || null,

    sbaCount: sbas,
    minFourSbas: sbas >= 4,
    deliveries: num(dig(row, 'anc.tot_facility_deliveries')),
    pphBundleAvailable: pphStocked,

    // Cold chain (#26).
    cceAssessed: ['yes', 'yes_no_therm', 'yes_faulty', 'no'].includes(cceRaw),
    cceFunctional: cceRaw === 'yes',

    // U5MR cross-check (#59) — neonatal proxy. Uses numPos: this field carries a
    // handful of `-99` ("not applicable") sentinels that must not net against the sum.
    neonatalDeaths: numPos(dig(row, 'mortality_data.newborn_deaths.number_of_neonatal_deaths')),

    // Maternal deaths (#58 cross-check) + cause breakdown (#60/#61/#62). The updated
    // workbook maps these SFM fields; SFM's n (742 deaths) is ~75x SRH's (10), so the
    // cause SHARES pool with SRH for a far more reliable distribution (levels/MMR do NOT
    // pool — SFM's rate is ~8x SRH's, a definitional gap flagged on #58).
    matDeaths: numPos(dig(row, MD + 'mds')),
    matPPH: causeSum(row, MD_PPH),
    matHTN: causeSum(row, MD_PEE),
    matSepsis: causeSum(row, MD_SEPSIS),
    // #58 MMR denominator exactly as the workbook maps it for the SFM side
    // (distinct from `totalDeliveries`/`deliveries` above — this is the facility-
    // delivery field the workbook pairs with `mds`).
    totalFacilityDeliveries: numPos(dig(row, 'mnh_data.maternal_stats.total_facility_deliveries')),

    // ANC1/ANC4 cross-check (#102/#103) — direct visit counts (not live-birth
    // buckets like SRH), denominator = total facility deliveries (this panel).
    ancOne: numPos(dig(row, 'anc.anc_one')),
    ancFour: numPos(dig(row, 'anc.anc_four')),
    totalDeliveries: numPos(dig(row, 'mnh_data.maternal_stats.total_deliveries')),

    // #97 deliveries attended by a skilled birth attendant — SFM-only; SRH has no
    // attended-delivery-by-SBA field (its SBA fields are staffing counts).
    sbaAttendedDeliveries: numPos(dig(row, 'mnh_data.maternal_stats.births_attended_by_sba')),

    // #27 maternal-health-equipment functionality — SFM covers 2 of the 5 workbook
    // items (neonatal Ambu bag, pulse oximeter); same always/sometimes/never_in_stock
    // scale as the drug/equipment panel, so reuse the strict `inStock` harmonisation.
    neoAmbuFunctional: inStock(dig(row, 'drugs_supply.equipment.neo_ambu_bag')),
    oximeterFunctional: inStock(dig(row, 'drugs_supply.equipment.oximeter')),
  };
}

function latestPerFacility(records) {
  const byKey = new Map();
  for (const r of records) {
    if (!r.state) continue;
    const key = `${r.state}|${r.lga}|${r.facility}`;
    const prev = byKey.get(key);
    if (!prev || String(r.submittedAt) > String(prev.submittedAt)) byKey.set(key, r);
  }
  return [...byKey.values()];
}

export async function loadSfmOdk(credentials) {
  const { rows, total } = await fetchAllOData(SERVICE_URL, 'Submissions', credentials);
  // Guard before anything aggregates: duplicate submissions would otherwise
  // double-count deliveries/deaths, and one row's impossible cause attribution
  // (20 causes for 4 deaths) drove Plateau's PPH share above 100%.
  const { records: flat } = sanitizeRecords(rows.map(flatten), 'SFM ODK');
  const snapshot = latestPerFacility(flat);
  return {
    name: 'SFM ODK',
    ok: true,
    rowsFetched: total,
    facilities: snapshot.length,
    quarters: [...new Set(flat.map((r) => r.quarter).filter(Boolean))].sort(),
    records: snapshot,
    allRecords: flat,
  };
}
