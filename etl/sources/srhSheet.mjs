/**
 * SRH Google Sheet adapter — the public "baseline" facility assessment export
 * (published CSV, no auth). A wide (~528-col) ODK export of 123 facilities.
 *
 * Used for the indicators the workbook maps to this sheet — "Proportion of
 * facilities with a minimum of 4 SBAs" (col `Total Availability Count of SBAs
 * (BEmONC/CEmONC)`) and 2 of the 5 maternal-health-equipment items for #27
 * (`Delivery beds`, `Manual Vacuum Aspiration (MVA) kits`) — plus facility-roster
 * enrichment. Nothing else here is mapped to an indicator.
 */
import Papa from 'papaparse';
import { normState, titleCase } from '../lib/states.mjs';
import { num } from '../lib/util.mjs';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS_3zLjUES9KRAYisIp8TODjs_RFY80HfH6hB-P9ixDFqhvhb5RQxtluq4ukc6IBc4Bz0x1ILg72TF/pub?gid=1896360197&single=true&output=csv';

// Exact header strings for the SBA availability counts (type-appropriate).
const COL = {
  sbaBemonc: 'Total Availability Count of SBAs ( BEmONC)',
  sbaCemonc: 'Total Availability Count of SBAs (CEmONC)',
  deliveryBed: 'Delivery beds',
  mvaKit: 'Manual Vacuum Aspiration (MVA) kits',
};

// Equipment status scale (#27): available_and_functional / available_but_non_functional /
// not_available. Strict, per the locked CCE precedent: only fully-functional counts.
const equipFunctional = (v) => String(v).trim().toLowerCase() === 'available_and_functional';

/** Count commodity-availability flags (columns ending in _Commod, value "1"). */
function commAvailable(row) {
  let n = 0;
  for (const [k, v] of Object.entries(row)) {
    if (/_Commod$/.test(k) && String(v).trim() === '1') n++;
  }
  return n;
}

function flatten(row) {
  const isCemonc = /cemonc/i.test(String(row.facility_type));
  // Type-appropriate SBA availability count. Blank ⇒ facility not assessed for
  // SBA availability (excluded from the indicator's denominator).
  const rawSba = (isCemonc ? row[COL.sbaCemonc] : row[COL.sbaBemonc]) ?? '';
  const sbaAssessed = String(rawSba).trim() !== '';
  const sba = num(rawSba);

  return {
    state: normState(row.STATE),
    lga: titleCase(row.LGA),
    facility: row.facility_name || 'Unknown facility',
    facilityType: row.facility_type || null,

    // SBA availability (drives "Proportion of facilities with a minimum of 4 SBAs").
    sbaAssessed,
    sbaCount: sba,
    minFourSbas: sbaAssessed && sba >= 4,

    // Facility-roster enrichment.
    commAvailableCount: commAvailable(row),

    // #27 maternal-health-equipment functionality — 2 of the 5 workbook items.
    deliveryBedFunctional: equipFunctional(row[COL.deliveryBed]),
    mvaFunctional: equipFunctional(row[COL.mvaKit]),
  };
}

export async function loadSrhSheet() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Google Sheet ${res.status} ${res.statusText}`);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const records = parsed.data
    .map(flatten)
    .filter((r) => r.state && r.facility !== 'Unknown facility');
  return {
    name: 'SRH Google Sheet (baseline)',
    ok: true,
    rowsFetched: parsed.data.length,
    facilities: records.length,
    records,
  };
}
