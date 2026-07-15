/**
 * Data-freshness formatting helpers. Used by the "Data as of…" indicator in the
 * app shell and the per-source freshness badges on the Source Dashboards page.
 */

/** Absolute date, e.g. "10 Jul 2026". Returns "—" for a missing/invalid value. */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Coarse relative age, e.g. "today", "3 days ago", "2 months ago". */
export function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}
