import { describe, it, expect } from 'vitest';
import {
  gradeFor,
  isGradeableIndicator,
  gradeableByBlock,
  scoreBlock,
  overallOf,
  scoreStatus,
  nationalScorecardRow,
  BLOCK_NAMES,
} from './scorecard';
import { varianceFor } from './targets';
import type { Blocks, Indicator } from './types';

/** Minimal indicator factory for the pure-core tests. */
function ind(name: string, pct: number, extra: Partial<Indicator> = {}): Indicator {
  return { name, tier: 1, value: String(pct), pct, meta: '', src: '', disagg: [], ...extra };
}

describe('gradeFor', () => {
  it('maps composites to letter bands', () => {
    expect(gradeFor(92)).toBe('A');
    expect(gradeFor(80)).toBe('A'); // inclusive lower bound
    expect(gradeFor(70)).toBe('B');
    expect(gradeFor(66.9)).toBe('C');
    expect(gradeFor(50)).toBe('C');
    expect(gradeFor(40)).toBe('D');
    expect(gradeFor(33.9)).toBe('F');
    expect(gradeFor(0)).toBe('F');
  });

  it('passes null / non-finite through as null', () => {
    expect(gradeFor(null)).toBeNull();
    expect(gradeFor(Number.NaN)).toBeNull();
    expect(gradeFor(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('isGradeableIndicator', () => {
  it('excludes raw "Number of" counts, keeps proportions/rates', () => {
    expect(isGradeableIndicator({ name: 'Number of deliveries in facilities' })).toBe(false);
    expect(isGradeableIndicator({ name: 'Number of SBAs recruited' })).toBe(false);
    expect(isGradeableIndicator({ name: 'Proportion of PHCs with all six tracer commodities available*' })).toBe(true);
    expect(isGradeableIndicator({ name: 'Maternal Mortality Ratio - BHCPF vs. non-BHCPF facilities' })).toBe(true);
  });
});

describe('scoreBlock', () => {
  it('averages inverse-aware goodness across measured indicators only', () => {
    const inds = [ind('a', 80), ind('b', 60), ind('c', 40)];
    // Only a and c have a measurement; b is unmeasured (null) → excluded from the mean.
    const res = scoreBlock(inds, (i) => (i.name === 'b' ? null : i.pct));
    expect(res.n).toBe(2);
    expect(res.score).toBe(60); // (80 + 40) / 2
    expect(res.contributors.map((c) => c.name)).toEqual(['a', 'c']);
  });

  it('returns a null score (never 0) when nothing is measured', () => {
    const res = scoreBlock([ind('a', 80)], () => null);
    expect(res.score).toBeNull();
    expect(res.n).toBe(0);
    expect(res.contributors).toEqual([]);
  });
});

describe('overallOf', () => {
  it('is the mean of the available block sub-scores, ignoring nulls', () => {
    expect(overallOf([80, 60, 40])).toBe(60);
    expect(overallOf([80, null, 40])).toBe(60);
    expect(overallOf([null, null, null])).toBeNull();
    expect(overallOf([])).toBeNull();
  });
});

describe('scoreStatus', () => {
  it('is a traffic light on the composite (higher always better)', () => {
    expect(scoreStatus(90)?.level).toBe('good');
    expect(scoreStatus(50)?.level).toBe('mid');
    expect(scoreStatus(20)?.level).toBe('poor');
    expect(scoreStatus(null)).toBeNull();
  });
});

describe('gradeableByBlock + nationalScorecardRow', () => {
  const blocks: Blocks = {
    'Facility Readiness': [ind('Proportion A', 90), ind('Number of X things', 50), ind('Proportion B', 70)],
    'Stock Status': [ind('Proportion C', 40)],
    'Service Delivery': [
      ind('Mortality rate', 80, { inverse: true }), // goodness = 100-80 = 20
      ind('Empty D', 0), // data gap → excluded
    ],
  };

  it('partitions gradeable indicators, dropping raw counts', () => {
    const g = gradeableByBlock(blocks);
    expect(g['Facility Readiness'].map((i) => i.name)).toEqual(['Proportion A', 'Proportion B']);
    expect(g['Stock Status']).toHaveLength(1);
    expect(g['Service Delivery']).toHaveLength(2);
  });

  it('computes the national row from each indicator national pct, inverse-aware', () => {
    const row = nationalScorecardRow(blocks);
    expect(row.blocks['Facility Readiness'].score).toBe(80); // (90 + 70)/2
    expect(row.blocks['Stock Status'].score).toBe(40);
    expect(row.blocks['Service Delivery'].score).toBe(20); // only the mortality indicator; 100-80
    expect(row.blocksMeasured).toBe(3);
    expect(row.overall).toBe(+(((80 + 40 + 20) / 3).toFixed(1))); // 46.7
    expect(row.grade).toBe('D');
  });

  it('covers exactly the three canonical blocks', () => {
    expect(BLOCK_NAMES).toHaveLength(3);
    const row = nationalScorecardRow(blocks);
    BLOCK_NAMES.forEach((bn) => expect(row.blocks[bn]).toBeDefined());
  });
});

describe('varianceFor', () => {
  it('computes signed variance against a national target', () => {
    const v = varianceFor('Proportion of children &lt;1 year who received Penta 3', 86.4);
    expect(v).not.toBeNull();
    expect(v!.target).toBe(95);
    expect(v!.delta).toBe(-8.6);
    expect(v!.meets).toBe(false);
  });

  it('marks at/above target as met', () => {
    const v = varianceFor('Proportion of children &lt;1 year who received Penta 3', 95);
    expect(v!.meets).toBe(true);
    expect(v!.delta).toBe(0);
  });

  it('returns null for untargeted indicators or empty values', () => {
    expect(varianceFor('Some untargeted indicator', 50)).toBeNull();
    expect(varianceFor('Proportion of children &lt;1 year who received Penta 3', 0)).toBeNull();
    expect(varianceFor('Proportion of children &lt;1 year who received Penta 3', undefined)).toBeNull();
  });
});
