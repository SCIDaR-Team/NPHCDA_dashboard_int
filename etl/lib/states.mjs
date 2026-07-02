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

/** Title-case an LGA/facility label from a source slug like "rano_gh". */
export function titleCase(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
