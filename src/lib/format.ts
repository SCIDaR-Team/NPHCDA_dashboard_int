/**
 * Display helpers.
 *
 * The preserved indicator data keeps HTML entities (&amp;, &le;, &mdash; …) exactly
 * as in the source workbook for data integrity. We decode them only at render time.
 */
const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&le;': '≤',
  '&ge;': '≥',
  '&lt;': '<',
  '&gt;': '>',
  '&mdash;': '—',
  '&ndash;': '–',
  '&middot;': '·',
  '&rarr;': '→',
  '&times;': '×',
  '&nbsp;': ' ',
  '&deg;': '°',
  '&approx;': '≈',
};

export function decodeHtml(input: string): string {
  if (!input) return input;
  return input.replace(
    /&amp;|&le;|&ge;|&lt;|&gt;|&mdash;|&ndash;|&middot;|&rarr;|&times;|&nbsp;|&deg;|&approx;/g,
    (m) => ENTITY_MAP[m] ?? m
  );
}

/** Strip the trailing "*" some indicator names carry (it flags a composite). */
export function hasComposite(name: string): boolean {
  return name.trim().endsWith('*');
}

export function cleanName(name: string): string {
  return decodeHtml(name).replace(/\*+$/, '').trim();
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
