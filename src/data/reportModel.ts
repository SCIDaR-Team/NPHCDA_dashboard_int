/**
 * Shared REPORT MODEL — the single structured description of an executive briefing.
 *
 * One model, three renderers: the Report Builder previews it as HTML, and the PDF and
 * Word exporters render the SAME model, so the three never drift. The one-click
 * "Executive PDF" button just builds this model at National scope / summary density.
 *
 * The document opens with SCOPE & DATA COVERAGE (how many live indicators, split by
 * theme and reporting programme, and the geographic reach) before drawing down into
 * performance — the way a stakeholder briefing should read. Every figure is real
 * measured data pulled from the SAME engines the dashboard uses (scorecard, scoped
 * engine, data-quality, targets), or a clearly-labelled national target. Narrative is
 * deterministic prose that interprets the figures; it never invents a number.
 */
import type { Blocks, FilterState, Indicator, KpiGroup, SnapshotMeta, TrendSeries } from './types';
import {
  BLOCK_NAMES,
  BLOCK_SHORT,
  gradeableByBlock,
  scoreBlock,
  overallOf,
  gradeFor,
  nationalScorecardRow,
  type Grade,
} from './scorecard';
import { scopedMeasurements } from './scopedEngine';
import { INDICATOR_FRAMEWORK } from './indicatorFramework';
import { varianceFor } from './targets';
import { scopeLabel } from './calculations';
import { cleanName } from '@/lib/format';
import { useSnapshotStore } from '@/store/snapshotStore';
import type { SnapshotFacts } from './scopedEngine';

export type ReportDensity = 'summary' | 'full';
export type SectionKind = 'coverage' | 'grade' | 'block';

/** A headline metric row (Overview KPIs). */
export interface ReportKpi {
  label: string;
  value: string;
  pct: number;
  target?: number;
  delta?: number;
}

/** A block indicator row (Readiness / Stock / Service), measured vs target. */
export interface ReportBlockRow {
  name: string;
  value: string;
  pct: number;
  target?: number;
  delta?: number;
}

/** The composite grade payload (Executive summary). */
export interface ReportGrade {
  overall: number | null;
  grade: Grade | null;
  blocks: { name: string; short: string; score: number | null }[];
}

/** Scope & data-coverage payload (opens the document). Indicator counts come from the
 *  authoritative prioritized-indicator framework (data/indicatorFramework); records,
 *  facilities and geographic reach are computed live from the reported facts. */
export interface ReportCoverage {
  live: number;
  total: number;
  noSource: number;
  themes: { name: string; short: string; indicators: number }[];
  programmes: { name: string; indicators: number; records: number; facilities: number }[];
  states: number;
  lgas: number;
  facilities: number;
}

export interface ReportSection {
  id: string;
  title: string;
  enabled: boolean;
  narrative: string;
  kind: SectionKind;
  coverage?: ReportCoverage;
  grade?: ReportGrade;
  kpis?: ReportKpi[];
  block?: { subScore: number | null; rows: ReportBlockRow[] };
}

export interface ReportModel {
  scopeLabel: string;
  generatedAt: string;
  meta: SnapshotMeta | null;
  density: ReportDensity;
  summary: string;
  sections: ReportSection[];
}

export interface ReportInputs {
  blocks: Blocks;
  kpiGroups: KpiGroup[];
  trends: TrendSeries | null;
  meta: SnapshotMeta | null;
  filter: FilterState;
  density?: ReportDensity;
}

/* ------------------------------------------------------------------ *
 * Scope helpers.
 * ------------------------------------------------------------------ */

function anyScope(f: FilterState): boolean {
  return !!(f.zone || f.state || f.lga || f.facility || f.facilityType || f.donor || f.source || f.year || f.month);
}
/** A scope that rescopes the measure engine (period excluded). */
function measureScope(f: FilterState): boolean {
  return !!(f.zone || f.state || f.lga || f.facility || f.facilityType || f.donor || f.source);
}

/* ------------------------------------------------------------------ *
 * Scope & data coverage.
 * ------------------------------------------------------------------ */

const PROG_ARRAYS: Record<string, (keyof SnapshotFacts)[]> = {
  SRH: ['srh', 'sheet'],
  SFM: ['sfm'],
  MAMII: ['mamii'],
  PFMO: ['pfmo'],
};
const PROG_ORDER = ['SRH', 'SFM', 'MAMII', 'PFMO'] as const;

/** Geography predicate for coverage reach (period is ignored — reach is cumulative). */
function geoMatch(f: FilterState) {
  return (r: { state?: string; zone?: string; lga?: string; facility?: string; type?: string | null; donor?: string[] }): boolean => {
    if (f.state && r.state !== f.state) return false;
    if (f.zone && r.zone !== f.zone) return false;
    if (f.lga && r.lga !== f.lga) return false;
    if (f.facility && r.facility !== f.facility) return false;
    if (f.facilityType && r.type !== f.facilityType) return false;
    if (f.donor && !(r.donor ?? []).includes(f.donor)) return false;
    return true;
  };
}

function buildCoverage(inputs: ReportInputs): ReportCoverage {
  const { filter } = inputs;
  const F = INDICATOR_FRAMEWORK;
  const indFor = (name: string): number => F.programmes.find((p) => p.name === name)?.indicators ?? 0;

  const facts = useSnapshotStore.getState().facts;
  const match = geoMatch(filter);
  const activeProgs = filter.source && PROG_ARRAYS[filter.source] ? [filter.source] : [...PROG_ORDER];

  const stateSet = new Set<string>();
  const lgaSet = new Set<string>();
  const facSet = new Set<string>();

  const programmes = activeProgs.map((p) => {
    let records = 0;
    const pfac = new Set<string>();
    for (const key of PROG_ARRAYS[p]) {
      const arr = (facts?.[key] ?? []) as { state?: string; lga?: string; facility?: string; zone?: string; type?: string | null; donor?: string[] }[];
      for (const r of arr) {
        if (!match(r)) continue;
        records += 1;
        const fk = `${r.state ?? ''}|${r.lga ?? ''}|${r.facility ?? ''}`;
        pfac.add(fk);
        facSet.add(fk);
        if (r.state) stateSet.add(r.state);
        if (r.state && r.lga) lgaSet.add(`${r.state}|${r.lga}`);
      }
    }
    return { name: p, indicators: indFor(p), records, facilities: pfac.size };
  });

  return {
    live: F.live,
    total: F.total,
    noSource: F.noSource,
    themes: F.themes,
    programmes,
    states: stateSet.size,
    lgas: lgaSet.size,
    facilities: facSet.size,
  };
}

/* ------------------------------------------------------------------ *
 * Grade + indicators.
 * ------------------------------------------------------------------ */

function goodness(ind: Pick<Indicator, 'inverse'>, pct: number | undefined): number | null {
  if (pct == null || pct <= 0) return null;
  return ind.inverse ? 100 - pct : pct;
}

function buildGrade(blocks: Blocks, filter: FilterState): ReportGrade {
  if (!measureScope(filter)) {
    const row = nationalScorecardRow(blocks);
    return {
      overall: row.overall,
      grade: row.grade,
      blocks: BLOCK_NAMES.map((bn) => ({ name: bn, short: BLOCK_SHORT[bn], score: row.blocks[bn].score })),
    };
  }
  const scoped = scopedMeasurements(filter);
  const byBlock = gradeableByBlock(blocks);
  const goodnessOf = (ind: Indicator): number | null => goodness(ind, scoped ? scoped[ind.name]?.pct : undefined);
  const blockScores = BLOCK_NAMES.map((bn) => ({ bn, s: scoreBlock(byBlock[bn], goodnessOf) }));
  const overall = overallOf(blockScores.map((b) => b.s.score));
  return {
    overall,
    grade: gradeFor(overall),
    blocks: blockScores.map((b) => ({ name: b.bn, short: BLOCK_SHORT[b.bn], score: b.s.score })),
  };
}

function scopedValue(ind: Indicator, filter: FilterState): { value: string; pct: number } | null {
  if (!measureScope(filter)) return { value: ind.value, pct: ind.pct };
  const m = scopedMeasurements(filter)?.[ind.name];
  return m ? { value: m.value, pct: m.pct } : null;
}

function buildKpis(inputs: ReportInputs): ReportKpi[] {
  const { blocks, kpiGroups, filter, density } = inputs;
  const byName: Record<string, Indicator> = {};
  for (const list of Object.values(blocks)) for (const i of list) byName[i.name] = i;
  const rows: ReportKpi[] = [];
  for (const card of kpiGroups.flatMap((g) => g.cards)) {
    const ind = card.indicator ? byName[card.indicator] : undefined;
    const sv = ind ? scopedValue(ind, filter) : { value: card.value, pct: card.pct };
    if (!sv) continue;
    const v = card.indicator ? varianceFor(card.indicator, sv.pct) : null;
    rows.push({ label: cleanName(card.label), value: sv.value, pct: sv.pct, target: v?.target, delta: v?.delta });
  }
  return density === 'summary' ? rows.slice(0, 6) : rows;
}

function buildBlock(blocks: Blocks, blockName: string, filter: FilterState, grade: ReportGrade, density: ReportDensity):
  ReportSection['block'] {
  const subScore = grade.blocks.find((b) => b.name === blockName)?.score ?? null;
  const inds = (blocks[blockName] ?? []).filter((i) => !/^\s*Number of/i.test(i.name));
  const rows: ReportBlockRow[] = [];
  for (const ind of inds) {
    const sv = scopedValue(ind, filter);
    if (!sv || sv.pct <= 0) continue;
    const v = varianceFor(ind.name, sv.pct);
    rows.push({ name: cleanName(ind.name), value: sv.value, pct: sv.pct, target: v?.target, delta: v?.delta });
  }
  rows.sort((a, b) => {
    const at = a.target != null, bt = b.target != null;
    if (at !== bt) return at ? -1 : 1;
    if (at && bt) return (a.delta ?? 0) - (b.delta ?? 0);
    return b.pct - a.pct;
  });
  return { subScore, rows: density === 'summary' ? rows.slice(0, 4) : rows };
}

/* ------------------------------------------------------------------ *
 * Auto-drafted narrative — deterministic prose that INTERPRETS the figures.
 * ------------------------------------------------------------------ */

const nf = (n: number): string => n.toLocaleString('en-US');
const fmtScore = (n: number | null): string => (n != null ? `${Math.round(n)}/100` : 'not gradeable');
const ptsOf = (n: number): string => `${Math.abs(Math.round(n))} point${Math.abs(Math.round(n)) === 1 ? '' : 's'}`;

function coverageProse(scope: string, c: ReportCoverage): string {
  const [a, b, d] = c.themes;
  const progs = c.programmes.map((p) => p.name).join(', ');
  const within = scope === 'National' ? 'nationwide' : `within ${scope}`;
  return (
    `This briefing covers ${c.total} prioritized indicators, of which ${c.live} are wired to a live data source and ${c.noSource} await one. ` +
    `They span three thematic areas — ${a.name} (${a.indicators}), ${b.name} (${b.indicators}) and ${d.name} (${d.indicators} indicators) — ` +
    `reported through ${c.programmes.length} programme${c.programmes.length === 1 ? '' : 's'} (${progs}). ` +
    `Together they reach ${nf(c.states)} states, ${nf(c.lgas)} LGAs and ${nf(c.facilities)} health facilities ${within}. ` +
    `The figures that follow are drawn exclusively from this reported data.`
  );
}

function summaryProse(scope: string, grade: ReportGrade, kpis: ReportKpi[]): string {
  if (grade.overall == null) {
    return `${scope} could not be graded from the currently available data — too few indicators carry a measurement for this scope. The figures below cover only what has been reported.`;
  }
  const measured = grade.blocks.filter((b) => b.score != null).sort((a, b) => (b.score as number) - (a.score as number));
  const strong = measured[0];
  const weak = measured[measured.length - 1];
  const targeted = kpis.filter((k) => k.target != null && k.delta != null);
  const met = targeted.filter((k) => (k.delta as number) >= 0).length;
  const worst = [...targeted].sort((a, b) => (a.delta as number) - (b.delta as number))[0];

  let s = `${scope} primary health-care performance scores ${fmtScore(grade.overall)}`;
  s += grade.grade ? ` — an overall grade of ${grade.grade}. ` : '. ';
  if (strong && weak && strong.name !== weak.name) {
    s += `${strong.name} is the strongest building block (${Math.round(strong.score as number)}), while ${weak.name} is the weakest (${Math.round(weak.score as number)}). `;
  }
  if (targeted.length) {
    s += `Of ${targeted.length} headline indicator${targeted.length === 1 ? '' : 's'} with a national target, ${met} ${met === 1 ? 'meets' : 'meet'} or exceed${met === 1 ? 's' : ''} it`;
    s += worst && (worst.delta as number) < 0 ? `; the widest gap is ${worst.label}, ${ptsOf(worst.delta as number)} below target.` : '.';
  }
  return s;
}

function blockProse(name: string, scope: string, block: NonNullable<ReportSection['block']>): string {
  if (!block.rows.length) return `No ${name.toLowerCase()} indicators are measured for ${scope}.`;
  const best = [...block.rows].sort((a, b) => b.pct - a.pct)[0];
  const below = block.rows.filter((r) => r.target != null && r.delta != null && (r.delta as number) < 0).sort((a, b) => (a.delta as number) - (b.delta as number))[0];
  let s = `${name} scores ${fmtScore(block.subScore)} for ${scope}. `;
  if (best) s += `The strongest signal is ${best.name} (${best.value}). `;
  if (below) s += `The widest gap to a national target is ${below.name}, ${ptsOf(below.delta as number)} below its ${below.target}% benchmark.`;
  else if (block.rows.some((r) => r.target != null)) s += `Every measured target in this block is met.`;
  return s;
}

/* ------------------------------------------------------------------ *
 * Assembly.
 * ------------------------------------------------------------------ */

export function buildReportModel(inputs: ReportInputs): ReportModel {
  const density: ReportDensity = inputs.density ?? 'full';
  const { blocks, filter } = inputs;
  const scope = anyScope(filter) ? scopeLabel(filter) : 'National';
  const coverage = buildCoverage(inputs);
  const grade = buildGrade(blocks, filter);
  const kpis = buildKpis({ ...inputs, density });

  const sections: ReportSection[] = [
    {
      id: 'coverage',
      title: 'Scope & data coverage',
      enabled: true,
      narrative: coverageProse(scope, coverage),
      kind: 'coverage',
      coverage,
    },
    {
      id: 'summary',
      title: 'Executive summary',
      enabled: true,
      narrative: summaryProse(scope, grade, kpis),
      kind: 'grade',
      grade,
      kpis,
    },
    ...BLOCK_NAMES.map((bn): ReportSection => {
      const block = buildBlock(blocks, bn, filter, grade, density);
      return {
        id: bn.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: bn,
        enabled: true,
        narrative: block ? blockProse(bn, scope, block) : '',
        kind: 'block',
        block,
      };
    }),
  ];

  // Prune only empty block sections; coverage + summary always stay.
  const pruned = sections.filter((s) => s.kind !== 'block' || (s.block?.rows.length ?? 0) > 0);

  return {
    scopeLabel: scope,
    generatedAt: new Date().toISOString(),
    meta: inputs.meta,
    density,
    summary: summaryProse(scope, grade, kpis),
    sections: pruned,
  };
}
