import { describe, it, expect } from 'vitest';
import { outliers, qualitySummary, type IndicatorQuality } from './dataQuality';

describe('outliers (1.5×IQR fence)', () => {
  it('flags a clear high outlier and leaves the pack alone', () => {
    const data = [10, 11, 12, 13, 12, 11, 10, 90].map((v) => ({ v }));
    const flagged = outliers(data, (d) => d.v);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].item.v).toBe(90);
    expect(flagged[0].bound).toBe('high');
  });

  it('flags a low outlier', () => {
    const data = [50, 52, 51, 49, 53, 50, 51, 2].map((v) => ({ v }));
    const flagged = outliers(data, (d) => d.v);
    expect(flagged.map((f) => f.item.v)).toContain(2);
    expect(flagged.find((f) => f.item.v === 2)!.bound).toBe('low');
  });

  it('needs at least 4 points and a non-zero IQR', () => {
    expect(outliers([{ v: 1 }, { v: 2 }, { v: 3 }], (d) => d.v)).toEqual([]);
    expect(outliers([5, 5, 5, 5, 5].map((v) => ({ v })), (d) => d.v)).toEqual([]);
  });
});

describe('qualitySummary', () => {
  const rows: IndicatorQuality[] = [
    { name: 'a', block: 'Stock Status', tier: 1, hasSource: true, measuredStates: 30, expectedStates: 37, completeness: 81.1, smallNStates: 2, outlierStates: [{ state: 'X', value: 90, bound: 'high' }] },
    { name: 'b', block: 'Stock Status', tier: 1, hasSource: true, measuredStates: 37, expectedStates: 37, completeness: 100, smallNStates: 0, outlierStates: [] },
    { name: 'c', block: 'Stock Status', tier: 3, hasSource: false, measuredStates: 0, expectedStates: 37, completeness: 0, smallNStates: 0, outlierStates: [] },
  ];

  it('rolls up source coverage, mean completeness and flag counts', () => {
    const s = qualitySummary(rows);
    expect(s.totalIndicators).toBe(3);
    expect(s.withSource).toBe(2);
    expect(s.missing).toBe(1);
    expect(s.meanCompleteness).toBe(90.5); // (81.1 + 100)/2 = 90.55 → toFixed(1) = 90.5
    expect(s.smallNFlags).toBe(2);
    expect(s.outlierFlags).toBe(1);
  });
});
