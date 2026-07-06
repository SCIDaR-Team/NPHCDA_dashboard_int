/**
 * MAMII adapter — a STATIC facility dataset (source system TBD), read directly
 * from a committed CSV (etl/data/MAMII.csv) exactly like the SRH Google Sheet is
 * read from its published URL. No auth, no network.
 *
 * Each row is one physical facility (State / LGA / Health Facility), but most
 * indicator columns are DENORMALISED aggregates repeated onto every facility row
 * in a group — so the columns have three different native grains:
 *   • FACILITY  — value differs row-to-row: "Total number of SBAs",
 *                 "Number of SBAs recruited", "…SBAs deployed…".
 *   • LGA       — constant within an LGA: "Total BHCPF Facilities (LGA)",
 *                 "…L2/L1 functional…", "Number of revitalized PHC facilities…".
 *   • STATE     — constant within a state: the four CBHW columns.
 * The measurement engine (lib/indicators.mjs) must therefore DEDUPE state/LGA
 * columns to one row per group before summing — never sum a state total across
 * its facility rows. Each record below carries the value at every level plus a
 * `stateKey`/`lgaKey` so the engine can dedupe deterministically.
 *
 * Columns are looked up BY HEADER NAME (not fixed index) so the loader is robust
 * to the leading-blank-row/column layout the export sometimes carries.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Papa from 'papaparse';
import { normState, titleCase, cleanName, zoneForState, donorsForState } from '../lib/states.mjs';
import { num } from '../lib/util.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(here, '..', 'data', 'MAMII.csv');

// Exact header strings in the MAMII export, grouped by native grain.
const COL = {
  state: 'State',
  lga: 'LGA',
  facility: 'Health Facility',
  // FACILITY-native.
  sbaTotal: 'Total number of SBAs',
  sbaRecruited: 'Number of SBAs recruited',
  sbaDeployed: 'Proportion of SBAs deployed per state (total number deployed)',
  recruitmentCommenced: '% of states that have commenced recruitment of SBAs',
  // STATE-native (CBHW workforce).
  cbhwRecruited: 'Proportion of CBHWs recruited (state)',
  cbhwTrained: 'Number of CBHWs trained (state)',
  cbhwDeployed: 'Proportion of CBHWs deployed per state (state)',
  cbhwAbsorbed: '% of recruited CBHWs that have been absorbed',
  // LGA-native (facility functionality + revitalisation).
  lgaTotalBhcpf: 'Total BHCPF Facilities (LGA)',
  l2: 'Proportion of L2 functional facilities per LGA (BHCPF)',
  l1: 'Proportion of L1 functional facilities per LGA',
  partial: 'Proportion of partially functional facilities per LGA',
  revitalized: 'Number of revitalized PHC facilities per LGA',
};

/** Numeric parse that returns null for blank / "#N/A" (so they gap out of sums,
 *  rather than being counted as a real 0). */
function numOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '' || /^#n\/?a$/i.test(s)) return null;
  const n = num(s);
  return Number.isFinite(n) ? n : null;
}

function flatten(row) {
  const state = normState(row[COL.state]);
  // MAMII emits LGA in ALL-CAPS ("BENDE"); lower-case first so titleCase yields
  // "Bende" and matches the ODK sources' casing in the shared filter dropdowns.
  const lga = titleCase(String(row[COL.lga] ?? '').toLowerCase());
  const facility = cleanName(row[COL.facility]) || 'Unknown facility';
  const sbaTotal = numOrNull(row[COL.sbaTotal]);
  return {
    state,
    zone: zoneForState(state),
    donor: donorsForState(state),
    lga,
    facility,
    facilityType: null, // MAMII carries no facility-type dimension.
    // Dedupe keys so the engine can collapse LGA/state-native columns.
    stateKey: state,
    lgaKey: state && lga ? `${state}|${lga}` : null,

    // FACILITY-native.
    sbaTotal,
    sbaAssessed: sbaTotal != null,
    minFourSbas: sbaTotal != null && sbaTotal >= 4,
    sbaRecruited: numOrNull(row[COL.sbaRecruited]) ?? 0,
    sbaDeployed: numOrNull(row[COL.sbaDeployed]) ?? 0,
    recruitmentCommenced: String(row[COL.recruitmentCommenced] ?? '').trim().toLowerCase() === 'yes',

    // STATE-native (one true value per state; identical across the state's rows).
    cbhwRecruited: numOrNull(row[COL.cbhwRecruited]) ?? 0,
    cbhwTrained: numOrNull(row[COL.cbhwTrained]) ?? 0,
    cbhwDeployed: numOrNull(row[COL.cbhwDeployed]) ?? 0,
    cbhwAbsorbed: numOrNull(row[COL.cbhwAbsorbed]) ?? 0,

    // LGA-native (one true value per LGA; identical across the LGA's rows).
    lgaTotalBhcpf: numOrNull(row[COL.lgaTotalBhcpf]),
    l2: numOrNull(row[COL.l2]),
    l1: numOrNull(row[COL.l1]),
    partial: numOrNull(row[COL.partial]),
    revitalized: numOrNull(row[COL.revitalized]), // null where the source has "#N/A".
  };
}

export async function loadMamii() {
  const text = readFileSync(CSV_PATH, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const records = parsed.data
    .map(flatten)
    .filter((r) => r.state && r.facility !== 'Unknown facility');
  return {
    name: 'MAMII (static dataset)',
    ok: true,
    rowsFetched: parsed.data.length,
    facilities: records.length,
    records,
  };
}
