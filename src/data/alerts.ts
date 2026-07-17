/**
 * Derive notification-center alerts from the REAL snapshot — below-target indicators,
 * failing states, data gaps, freshness and outliers. Everything here is grounded in
 * measured data or a labelled policy target; no fabricated events.
 */
import type { Blocks, SnapshotMeta } from './types';
import type { AppNotification } from '@/store/notificationStore';
import { scorecardRows } from './scorecard';
import { NATIONAL_TARGETS, varianceFor } from './targets';
import { indicatorQualities, qualitySummary } from './dataQuality';
import { ALL_STATES } from './geo/states';
import { cleanName } from '@/lib/format';
import { relativeTime } from '@/lib/freshness';
import { indicatorAnchorId, BLOCK_ROUTES } from '@/app/navigation';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Deep-link to an indicator's card on its thematic page, when we can resolve it. */
function indicatorHref(blocks: Blocks, name: string): string | undefined {
  for (const [bn, list] of Object.entries(blocks)) {
    if (list.some((i) => i.name === name)) {
      const route = BLOCK_ROUTES[bn as keyof typeof BLOCK_ROUTES];
      if (route) return `${route}#${indicatorAnchorId(name)}`;
    }
  }
  return undefined;
}

export function deriveAlerts(blocks: Blocks, meta: SnapshotMeta | null): AppNotification[] {
  const time = relativeTime(meta?.generatedAt) || 'recent';
  const out: AppNotification[] = [];

  // 1. Stale snapshot (monthly cadence → warn past ~35 days).
  if (meta?.generatedAt) {
    const ageDays = Math.floor((Date.now() - new Date(meta.generatedAt).getTime()) / 86_400_000);
    if (ageDays > 35) {
      out.push({
        id: 'alert-stale',
        tone: 'warning',
        title: 'Snapshot may be stale',
        description: `The data snapshot is ${ageDays} days old. A monthly refresh is expected.`,
        time,
        read: false,
        href: '/app/data-quality',
      });
    }
  }

  // 2. Indicators furthest below their national target.
  const byName = Object.fromEntries(Object.values(blocks).flat().map((i) => [i.name, i]));
  const belowTarget = Object.keys(NATIONAL_TARGETS)
    .map((name) => {
      const ind = byName[name];
      const v = ind ? varianceFor(name, ind.pct) : null;
      return v && v.delta < -5 ? { name, delta: v.delta, target: v.target, actual: v.actual } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 4);
  for (const b of belowTarget) {
    out.push({
      id: `alert-below-${slug(b.name)}`,
      tone: b.delta < -20 ? 'error' : 'warning',
      title: `Below target: ${cleanName(b.name)}`,
      description: `At ${Math.round(b.actual)}% vs a ${b.target}% target (${b.delta} pts).`,
      time,
      read: false,
      href: indicatorHref(blocks, b.name),
    });
  }

  // 3. Weakest states by composite grade (D/F).
  const failing = scorecardRows(blocks, 'state', ALL_STATES)
    .filter((r) => r.overall != null && (r.grade === 'D' || r.grade === 'F'))
    .sort((a, b) => (a.overall as number) - (b.overall as number))
    .slice(0, 3);
  for (const s of failing) {
    out.push({
      id: `alert-state-${slug(s.label)}`,
      tone: s.grade === 'F' ? 'error' : 'warning',
      title: `${s.label} grading ${s.grade}`,
      description: `Composite ${Math.round(s.overall as number)}/100 — among the weakest states.`,
      time,
      read: false,
      href: '/app/scorecard',
    });
  }

  // 4. Data-quality rollup (gaps / small samples / outliers).
  const quality = qualitySummary(indicatorQualities(blocks));
  if (quality.missing > 0) {
    out.push({
      id: 'alert-gaps',
      tone: 'info',
      title: `${quality.missing} indicators without a live source`,
      description: 'These remain intentional data gaps until a source connects.',
      time,
      read: false,
      href: '/app/data-quality',
    });
  }
  if (quality.outlierFlags > 0 || quality.smallNFlags > 0) {
    out.push({
      id: 'alert-quality-flags',
      tone: 'info',
      title: 'Data-quality flags to review',
      description: `${quality.outlierFlags} outlier and ${quality.smallNFlags} small-sample flags across indicators.`,
      time,
      read: false,
      href: '/app/data-quality',
    });
  }

  return out;
}
