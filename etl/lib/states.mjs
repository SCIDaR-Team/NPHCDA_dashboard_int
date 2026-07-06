/**
 * Canonical Nigerian state names (must match src/data/geo/states.ts ALL_STATES,
 * which the UI/map key on) plus a normaliser for the varied spellings/casing the
 * source systems emit (e.g. "kano", "cross river", "FCT Abuja").
 */

export const ALL_STATES = [
  'Sokoto', 'Katsina', 'Kebbi', 'Zamfara', 'Kano', 'Jigawa', 'Yobe', 'Borno', 'Niger', 'Kaduna',
  'Bauchi', 'Gombe', 'Adamawa', 'Kwara', 'FCT', 'Nasarawa', 'Plateau', 'Taraba', 'Oyo', 'Osun',
  'Ekiti', 'Kogi', 'Benue', 'Ogun', 'Ondo', 'Edo', 'Anambra', 'Enugu', 'Ebonyi', 'Lagos', 'Delta',
  'Imo', 'Abia', 'Cross River', 'Bayelsa', 'Rivers', 'Akwa Ibom',
];

const LOOKUP = new Map(ALL_STATES.map((s) => [s.toLowerCase(), s]));
// Common aliases / alternate spellings seen across sources.
const ALIASES = {
  'fct abuja': 'FCT',
  'abuja': 'FCT',
  'federal capital territory': 'FCT',
  'cross-river': 'Cross River',
  'akwa-ibom': 'Akwa Ibom',
  'nassarawa': 'Nasarawa',
};

/** Normalise a raw state string to a canonical name, or null if unrecognised. */
export function normState(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (LOOKUP.has(key)) return LOOKUP.get(key);
  if (ALIASES[key]) return ALIASES[key];
  // tolerate " state" suffix
  const stripped = key.replace(/\s+state$/, '');
  if (LOOKUP.has(stripped)) return LOOKUP.get(stripped);
  if (ALIASES[stripped]) return ALIASES[stripped];
  return null;
}

/**
 * Clean a facility/label string: strip leading junk the source systems prefix
 * onto some names (e.g. Ebonyi's "?Gh Onicha" → "Gh Onicha") and tidy whitespace.
 * A lone leading "?" is an encoding artefact, not part of the real name.
 */
export function cleanName(raw) {
  if (raw == null) return raw;
  return String(raw)
    .replace(/^[\s?¿*·.,;:_\-–—]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title-case an LGA/facility label from a source slug like "rano_gh". */
export function titleCase(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ *
 * Derived dimensions: Zone and Donor/Programme.
 *
 * Neither is collected as a raw field by any of the three sources, but both
 * are deterministic functions of the (normalised) STATE — so they can be
 * stamped onto every record and will apply automatically to any future data.
 *
 * Both maps MUST mirror src/data/geo/states.ts (ZONE_STATES / STATE_DONORS),
 * which the app's FilterDrawer uses to build the zone/donor dropdowns. Keep
 * them in sync — same policy as ALL_STATES above.
 * ------------------------------------------------------------------ */

/** Geopolitical-zone membership (6 zones → member states). */
export const ZONE_STATES = {
  'North Central': ['Benue', 'Kogi', 'Kwara', 'Nasarawa', 'Niger', 'Plateau', 'FCT'],
  'North East': ['Adamawa', 'Bauchi', 'Borno', 'Gombe', 'Taraba', 'Yobe'],
  'North West': ['Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Sokoto', 'Zamfara'],
  'South East': ['Abia', 'Anambra', 'Ebonyi', 'Enugu', 'Imo'],
  'South South': ['Akwa Ibom', 'Bayelsa', 'Cross River', 'Delta', 'Edo', 'Rivers'],
  'South West': ['Ekiti', 'Lagos', 'Ogun', 'Ondo', 'Osun', 'Oyo'],
};

const ZONE_OF_STATE = {};
for (const [zone, states] of Object.entries(ZONE_STATES)) {
  for (const st of states) ZONE_OF_STATE[st] = zone;
}

/** Geopolitical zone for a canonical state name, or null if unknown. */
export function zoneForState(state) {
  return state ? (ZONE_OF_STATE[state] ?? null) : null;
}

/**
 * SRH/MNH donor-programme footprint per state (preserved business data). A
 * state with no entry simply has no mapped donor — an empty list, not an error.
 */
export const STATE_DONORS = {
  Sokoto: ['EU-UNFPA', 'CIFF'], Katsina: ['Gates Foundation'], Jigawa: ['CIFF'], Kano: ['Gates Foundation'], Yobe: ['Gates Foundation'], Borno: ['Gates Foundation'],
  Kaduna: ['Gates Foundation'], Niger: ['Gates Foundation'], Bauchi: ['Gates Foundation', 'CIFF'], Gombe: ['CIFF'], Plateau: ['Gates Foundation'], Adamawa: ['EU-UNFPA'],
  Nasarawa: ['EU-UNFPA'], Kwara: ['EU-UNFPA'], Kogi: ['CIFF'], Lagos: ['Gates Foundation', 'CIFF'], Anambra: ['Gates Foundation'],
  Ebonyi: ['Gates Foundation', 'CIFF'], Abia: ['CIFF'], Bayelsa: ['CIFF'],
  Kebbi: ['LAD'], Zamfara: ['LAD'], Ekiti: ['LAD'], Ondo: ['LAD'], Enugu: ['LAD'], Benue: ['LAD'], Taraba: ['LAD'], 'Akwa Ibom': ['LAD'],
};

/** Donor/programme list for a canonical state name ([] if none mapped). */
export function donorsForState(state) {
  return (state && STATE_DONORS[state]) || [];
}
