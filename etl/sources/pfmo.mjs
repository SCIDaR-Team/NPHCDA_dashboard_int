/**
 * PFMO adapter — the PFMO Data Export API (https://api.app.pfmo.ng/api/v1).
 *
 * The API exposes BHCPF facility-form submissions one calendar month at a time,
 * paginated (page_size caps at 500 parent submissions/page). It is the only
 * NATIONAL source (~37 states, ~36k facilities) and supplies fields no other
 * feed carries — the true `live_births_monthly` denominator for MMR/U5MR,
 * Penta1/3, the concatenated `facility_commodities_available` (all six tracers),
 * essential-services offered, the full maternal-equipment set (incl. episiotomy),
 * and DFF/capitation amounts.
 *
 * Auth: the key is sent in the `X-API-Key` header (env PFMO_API_KEY). It NEVER
 * ships to the browser — like every other credential this runs only in the ETL.
 *
 * Shape (post-2026-07 API): { data: { page: { forms:[{ name, sheets:{ submissions:[…] } }],
 * page, page_size, total, total_pages } } }. Data quirks handled below: multi-selects
 * are DOUBLE JSON-encoded (`"[\"ANC\"]"`); SOME numeric cells are quoted (`"1"`);
 * booleans are the strings "true"/"false"; and facility-entered counts carry gross
 * data-entry typos (see FLOW_CAPS).
 *
 * We fetch every populated month, then per facility keep the LATEST submission's
 * point-in-time status (equipment, services, commodities, functional inputs) and
 * SUM the monthly flow fields across the window (deaths, live births, deliveries,
 * ANC, Penta) so rates like MMR rest on as many events as the data offers.
 */
import { num, numPos } from '../lib/util.mjs';
import { normState, titleCase, cleanName, zoneForState, donorsForState } from '../lib/states.mjs';

const BASE = 'https://api.app.pfmo.ng/api/v1/external/export/monthly';
// The server caps page_size at 500, but large pages (esp. the biggest month) are
// slow to generate and drop mid-transfer. Smaller pages download in ~3–4s and are
// far more reliable; we recover the extra round-trips with bounded concurrency.
const PAGE_SIZE = 150;
const CONCURRENCY = 3; // pages in flight at once (stays under the 60 req/min limit)
const REQUEST_TIMEOUT_MS = 60_000; // per-page ceiling
const MAX_ATTEMPTS = 6; // retries per page before giving up on the whole source

// Reporting periods (by submitted_at month) that carry facility submissions.
// Auto-discovered 2026-07-06: Dec 2025 + Mar–Jul 2026 are populated; earlier
// months are empty. Kept explicit so a refresh is deterministic and cheap.
const DEFAULT_PERIODS = [
  { year: 2025, month: 12 },
  { year: 2026, month: 3 },
  { year: 2026, month: 4 },
  { year: 2026, month: 5 },
  { year: 2026, month: 6 },
  { year: 2026, month: 7 },
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Strip a single pair of wrapping double-quotes PFMO adds to some text cells. */
function unquote(s) {
  if (s == null) return '';
  const t = String(s).trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).trim() : t;
}

/**
 * Numeric parse that first strips wrapping quotes. PFMO stores SOME numeric cells
 * as quoted strings (`"1"`, `"0"`) and others bare (`1`) — `num('"1"')` is NaN→0,
 * which silently zeroed the Ambu-bag / MVA / episiotomy-functional equipment counts.
 * Always parse numerics through this.
 */
const n = (v) => num(unquote(v));
const nPos = (v) => numPos(unquote(v));

/**
 * Parse a PFMO multi-select answer into a string[] of labels. The API DOUBLE-encodes
 * these: the field is a JSON string whose content is itself a JSON array
 * (e.g. the literal characters `"[\"ANC\",\"Immunization\"]"`). So we JSON.parse
 * repeatedly until we reach an array — which also tolerates the single-encoded and
 * already-array shapes.
 */
function parseList(v) {
  if (v == null || v === '') return [];
  let cur = v;
  for (let i = 0; i < 3 && typeof cur === 'string'; i++) {
    try {
      cur = JSON.parse(cur);
    } catch {
      break;
    }
  }
  if (Array.isArray(cur)) return cur.map((x) => String(x).trim()).filter(Boolean);
  // Fallback: a bare/partly-stringified value — strip brackets/quotes and split.
  return String(cur).replace(/^\[|\]$/g, '').split(',').map((x) => x.replace(/^"+|"+$/g, '').trim()).filter(Boolean);
}

/** PFMO booleans are the strings "true"/"false" (also tolerate yes/no and quoting). */
function boolYes(v) {
  const s = unquote(v).toLowerCase();
  return s === 'true' || s === 'yes';
}

/** "24 hours" → 24; "Others"/"" → 0. */
function operatingHours(v) {
  const m = /(\d+)/.exec(String(v ?? ''));
  return m ? Number(m[1]) : 0;
}

/**
 * Per-facility-MONTH plausibility ceilings for the monthly count fields. PFMO is
 * facility-entered and carries data-entry typos that are astronomically large
 * (e.g. a maternal_deaths_monthly of 4.4e45, a Penta3 of 64,699) — summed as-is
 * they obliterate national totals. Any value above its ceiling is treated as an
 * entry error and dropped (counted as 0, logged for the data team). Ceilings are
 * generous clinical bounds for a single PHC in one month (observed real maxima are
 * well under these: live births ~215, maternal deaths ~12, Penta1 ~415).
 */
const FLOW_CAPS = {
  livebirths: 1500,
  maternalDeaths: 40,
  under5Deaths: 60,
  facilityDeliveries: 1500,
  anc1: 2500,
  anc4: 2500,
  modernContraception: 3000,
  penta1: 2000,
  penta3: 2000,
};

/* ── Indicator reductions stamped per record so the shipped facts stay SLIM ──────
 * Shipping the raw commodity/service/equipment arrays for every facility-month blew
 * the snapshot past 130MB (GitHub rejects >100MB). Instead we pre-compute the
 * per-facility booleans the #17/#27/#47 engine needs, here at the source, and drop
 * the heavy arrays from the facts (transform.buildFacts). The boolean logic is the
 * single definition — the indicator engine just counts them. */

// #17 six tracer commodities (labels as they appear in facility_commodities_available).
const PFMO_TRACERS = ['Oxytocin injection', 'Multiple micronutrient supplements', 'Artemisinin based combination therapy (ACT)', 'Pentavalent vaccines', 'HIV test kits'];
const PFMO_CONTRA = ['IUD kits', 'Emergency contraceptive pills', 'Contraceptive implants', 'Injectable contraceptive', 'Female condoms'];
const PFMO_EQUIP_ITEMS = ['deliveryBed', 'episiotomy', 'mva', 'ambuBag', 'pulseOximeter'];

// #47 essential services, matched across PFMO's three form-version vocabularies
// (title-case labels, space-joined clinical slugs, the PHC minimum-package taxonomy)
// so no facility is dropped for using a different form.
const PFMO_SERVICE_MATCHERS = {
  Immunization: { exact: ['immunization'], sub: ['immunization', 'immunisation'] },
  'Family planning': { exact: ['family planning'], sub: ['family planning', 'family_planning', 'fp_services'] },
  ANC: { exact: ['anc'], sub: ['antenatal', 'maternal_and_child_health'] },
  'Labour and Delivery': { exact: ['labour and delivery'], sub: ['delivery', 'labour', 'maternal_and_child_health'] },
  'Malaria treatment': { exact: ['malaria treatment'], sub: ['malari'] },
  'HIV diagnosis': { exact: ['hiv diagnosis'], sub: ['hiv_services', 'hiv diagnosis', 'hiv_diagnosis', 'voluntary_counseling_and_screening'] },
};
const PFMO_REQ_SERVICES = Object.keys(PFMO_SERVICE_MATCHERS);
function offersService(services, m) {
  const lower = services.map((s) => s.toLowerCase());
  const hay = ' ' + lower.join(' ') + ' ';
  return m.exact.some((e) => lower.includes(e)) || m.sub.some((p) => hay.includes(p));
}

/** Pre-compute the #17/#27/#47 booleans for one facility-month record. */
function stampReductions(commodities, services, equip) {
  const commReported = commodities.length > 0;
  const svcReported = services.length > 0;
  const equipReported = Object.values(equip).some((e) => e.available || e.functional);
  return {
    commReported,
    tracer6: commReported && PFMO_TRACERS.every((t) => commodities.includes(t)) && PFMO_CONTRA.filter((t) => commodities.includes(t)).length >= 3,
    svcReported,
    svc6: svcReported && PFMO_REQ_SERVICES.every((s) => offersService(services, PFMO_SERVICE_MATCHERS[s])),
    equipReported,
    equip5: equipReported && PFMO_EQUIP_ITEMS.every((k) => equip[k].available > 0 && equip[k].functional > 0),
  };
}

/** numPos with a plausibility ceiling; over-ceiling values are logged and zeroed. */
function capped(raw, field, ctx, drops) {
  const v = nPos(raw);
  if (v > FLOW_CAPS[field]) {
    drops.push({ field, value: v, state: ctx.state, facility: ctx.facility });
    return 0;
  }
  return v;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch one page as JSON, resilient to the flaky big-payload transfers this API
 * is prone to. Retries with exponential backoff on:
 *   - network faults (ECONNRESET / "terminated" / DNS) that reject `fetch`,
 *   - a per-request timeout (AbortController) so a hung socket can't stall the run,
 *   - 429 (rate limit) and 5xx (transient server) responses.
 * 4xx other than 429 are treated as fatal (bad key / bad params — retrying won't help).
 */
async function fetchPage(url, key, label) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { 'X-API-Key': key }, signal: ac.signal });
      if (res.ok) return await res.json();
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`${label}: HTTP ${res.status}`);
      } else {
        // 400/401/403 — permanent; surface immediately.
        throw new Error(`${label}: HTTP ${res.status} (non-retryable)`);
      }
    } catch (err) {
      if (err.message?.includes('non-retryable')) throw err;
      lastErr = err; // network fault or abort/timeout — retry
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) {
      const backoff = Math.min(30_000, 2_000 * 2 ** (attempt - 1)); // 2s,4s,8s,16s,30s
      console.warn(`  … ${label} attempt ${attempt} failed (${lastErr.message}); retrying in ${backoff / 1000}s`);
      await sleep(backoff);
    }
  }
  throw new Error(`${label}: gave up after ${MAX_ATTEMPTS} attempts — ${lastErr?.message}`);
}

/** Pull every `submissions` row out of one page body. */
function submissionsOf(body) {
  const out = [];
  for (const form of body?.data?.page?.forms ?? []) {
    for (const r of form.sheets?.submissions ?? []) out.push(r);
  }
  return out;
}

const pageUrl = (year, month, page) =>
  `${BASE}?month=${month}&year=${year}&page=${page}&page_size=${PAGE_SIZE}`;
const pageLabel = (year, month, page) =>
  `PFMO ${year}-${String(month).padStart(2, '0')} page ${page}`;

/**
 * Fetch one month, walking every page. Page 1 tells us the page count; the rest
 * are fetched in bounded-concurrency waves so a big month doesn't run serially
 * for minutes. Each page is individually resilient (see `fetchPage`).
 */
async function fetchMonth({ year, month }, key) {
  const first = await fetchPage(pageUrl(year, month, 1), key, pageLabel(year, month, 1));
  const rows = submissionsOf(first);
  const totalPages = first?.data?.page?.total_pages ?? 1;

  for (let start = 2; start <= totalPages; start += CONCURRENCY) {
    const batch = [];
    for (let page = start; page < start + CONCURRENCY && page <= totalPages; page++) {
      batch.push(fetchPage(pageUrl(year, month, page), key, pageLabel(year, month, page)));
    }
    const bodies = await Promise.all(batch);
    for (const body of bodies) rows.push(...submissionsOf(body));
  }
  return rows;
}

/** Flatten one raw PFMO submission into a source-agnostic record. */
function flatten(row, period, drops) {
  const state = normState(unquote(row.state));
  const facility = cleanName(unquote(row.health_facility_name)) || 'Unknown facility';
  const commodities = parseList(row.facility_commodities_available);
  const services = parseList(row.health_facility_services_offered);
  const cadres = parseList(row.facility_staff_cadres);
  const ctx = { state, facility };
  const equip = {
    deliveryBed: { available: n(row.delivery_beds_number_available), functional: n(row.delivery_beds_number_functional) },
    episiotomy: { available: n(row.episiotomy_suturing_set_number_available), functional: n(row.episiotomy_suturing_set_number_functional) },
    mva: { available: n(row.manual_vacuum_aspirator_number_available), functional: n(row.manual_vacuum_aspirator_number_functional) },
    ambuBag: { available: n(row.ambu_bag_neonatal_number_available), functional: n(row.ambu_bag_neonatal_number_functional) },
    pulseOximeter: { available: n(row.pulse_oximeter_number_available), functional: n(row.pulse_oximeter_number_functional) },
  };

  return {
    facilityId: unquote(row.unique_facility_id) || null,
    state,
    zone: zoneForState(state),
    donor: donorsForState(state),
    lga: titleCase(unquote(row.lga)),
    ward: cleanName(unquote(row.federal_inec_ward)) || null,
    facility,
    // PFMO carries no BEmONC/CEmONC facility type; left null so it never shadows a real type.
    facilityType: null,
    month: period ? `${MONTH_SHORT[period.month - 1]} ${period.year}` : null,
    submittedAt: row.submitted_at || row.assessment_date || null,
    status: String(row.status ?? '').trim(), // APPROVED / PENDING

    // ── Monthly FLOW fields (summed per facility across the window; typos capped) ──
    livebirths: capped(row.live_births_monthly, 'livebirths', ctx, drops),
    maternalDeaths: capped(row.maternal_deaths_monthly, 'maternalDeaths', ctx, drops),
    under5Deaths: capped(row.under5_deaths_monthly, 'under5Deaths', ctx, drops),
    facilityDeliveries: capped(row.facility_based_deliveries_monthly, 'facilityDeliveries', ctx, drops),
    anc1: capped(row.anc_first_visits_monthly, 'anc1', ctx, drops),
    anc4: capped(row.anc_fourth_visits_monthly, 'anc4', ctx, drops),
    modernContraception: capped(row.modern_contraception_users_monthly, 'modernContraception', ctx, drops),
    penta1: capped(row.penta1_received_monthly, 'penta1', ctx, drops),
    penta3: capped(row.penta3_received_monthly, 'penta3', ctx, drops),

    // ── Point-in-time STATUS — kept raw for the ETL, and reduced to the #17/#27/#47
    // booleans below (stampReductions) so the SHIPPED facts can drop the heavy arrays.
    servicesOffered: services,
    commoditiesAvailable: commodities,
    equip,
    ...stampReductions(commodities, services, equip),
    // #14 / #30 staff. NB: staff_count_* are largely EMPTY in the live data;
    // `staffCadres` (types present) and `numberOfMidwives` are the populated signals.
    staffCadres: cadres,
    numberOfMidwives: n(row.number_of_midwives),
    staffCounts: {
      nursesMidwives: n(row.staff_count_nurses_midwives),
      medicalOfficers: n(row.staff_count_medical_officers_doctors),
      cho: n(row.staff_count_cho),
      schew: n(row.staff_count_schew),
      jchew: n(row.staff_count_jchew),
    },
    // #30–33 functional-status inputs (facility formula in the workbook).
    functional: {
      operatingHours: operatingHours(row.facility_operating_hours),
      operationalStatus: unquote(row.facility_operational_status), // Intact / Dilapidated / …
      hasStaffAccommodation: boolYes(row.has_staff_accommodation),
      staffAccommodationInUse: boolYes(row.staff_accommodation_in_use),
      mainPowerSource: unquote(row.main_power_source),
      hasBackupPower: boolYes(row.has_backup_power),
      generatorFunctional: boolYes(row.is_generator_functional),
      waterSources: parseList(row.water_source),
      hasElevatedWaterTank: boolYes(row.has_elevated_water_tank),
      handwashing: parseList(row.handwashing_facilities),
    },
    // #49 funds expected vs received; #52/#53 NHIA capitation.
    catchmentPopulation: n(row.catchment_population),
    expectedDffAmount: n(row.expected_dff_amount),
    receivedDffAmount: n(row.received_dff_amount),
    expectedCapitationAmount: n(row.expected_capitation_amount),
    capitationReceivedAmount: n(row.capitation_received_amount),
    receivedCapitation: boolYes(row.received_capitation),
  };
}

/**
 * Keep the LATEST submission per group (by `submittedAt`). Used twice to mirror the
 * records/allRecords contract every other source and the browser engine expect:
 *   - allRecords = latest per facility-MONTH (drops the many intra-month duplicate
 *     submissions PFMO carries, so summed monthly flows aren't double-counted);
 *   - records    = latest per facility (state|lga|facility — the SAME key the browser
 *     scopedEngine uses), the point-in-time status snapshot.
 * The indicator engine then sums FLOW fields over allRecords and reads STATUS fields
 * off records, so the ETL national and the browser scoped values stay in lockstep.
 */
function latestPer(rows, keyOf) {
  const byKey = new Map();
  for (const r of rows) {
    if (!r.state) continue; // drop rows we can't place on the map
    const key = keyOf(r);
    const prev = byKey.get(key);
    if (!prev || String(r.submittedAt) > String(prev.submittedAt)) byKey.set(key, r);
  }
  return [...byKey.values()];
}

const facilityKey = (r) => r.facilityId || `${r.state}|${r.lga}|${r.facility}`;

/**
 * @param {string} key  PFMO_API_KEY (sent as X-API-Key).
 * @param {{periods?: {year:number,month:number}[]}} [opts]
 */
export async function loadPfmo(key, opts = {}) {
  const periods = opts.periods ?? DEFAULT_PERIODS;
  const flat = [];
  const drops = []; // over-ceiling data-entry typos, for the quality log
  for (const period of periods) {
    const rows = await fetchMonth(period, key);
    for (const row of rows) flat.push(flatten(row, period, drops));
    console.log(`  · PFMO ${period.year}-${String(period.month).padStart(2, '0')}: ${rows.length} submissions (running total ${flat.length})`);
  }
  // allRecords: one row per facility-month (flow sums use this — no intra-month
  // double-count). records: latest submission per facility (status snapshot).
  const allRecords = latestPer(flat, (r) => `${facilityKey(r)}|${r.month}`);
  const snapshot = latestPer(allRecords, facilityKey);

  if (drops.length) {
    const byField = {};
    for (const d of drops) (byField[d.field] ||= []).push(d);
    console.warn(`  ⚠ PFMO dropped ${drops.length} implausible facility-month value(s) as data-entry errors:`);
    for (const [field, ds] of Object.entries(byField)) {
      const worst = ds.sort((a, b) => b.value - a.value)[0];
      console.warn(`      ${field}: ${ds.length} (max ${worst.value.toExponential(1)} @ ${worst.state}/${worst.facility})`);
    }
  }

  return {
    name: 'PFMO',
    ok: true,
    rowsFetched: flat.length,
    facilities: snapshot.length,
    states: [...new Set(snapshot.map((r) => r.state).filter(Boolean))].sort(),
    months: [...new Set(allRecords.map((r) => r.month).filter(Boolean))],
    droppedOutliers: drops.length,
    records: snapshot, // latest per facility (status)
    allRecords, // one row per facility-month (flow sums / period scoping)
  };
}
