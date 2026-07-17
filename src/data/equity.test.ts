import { describe, it, expect } from 'vitest';
import { groupMeans, equityGap } from './equity';

const values = { A: 80, B: 60, C: 30, D: 90 };
const groupOf = (s: string) => (s === 'A' || s === 'B' ? 'G1' : 'G2');

describe('groupMeans', () => {
  it('means each group and reports best/worst', () => {
    const stats = groupMeans(values, groupOf, ['G1', 'G2']);
    const g1 = stats.find((s) => s.group === 'G1')!;
    expect(g1.mean).toBe(70); // (80+60)/2
    expect(g1.n).toBe(2);
    expect(g1.best).toEqual({ state: 'A', value: 80 });
    expect(g1.worst).toEqual({ state: 'B', value: 60 });
  });

  it('returns empty groups in order with a null mean', () => {
    const stats = groupMeans({ A: 50 }, () => 'G1', ['G1', 'G2', 'G3']);
    expect(stats.map((s) => s.group)).toEqual(['G1', 'G2', 'G3']);
    expect(stats[1].mean).toBeNull();
    expect(stats[1].n).toBe(0);
  });

  it('skips states with no group', () => {
    const stats = groupMeans({ A: 50, Z: 99 }, (s) => (s === 'A' ? 'G1' : undefined), ['G1']);
    expect(stats[0].n).toBe(1);
    expect(stats[0].mean).toBe(50);
  });
});

describe('equityGap', () => {
  it('is the spread between the highest and lowest group mean', () => {
    const stats = groupMeans(values, groupOf, ['G1', 'G2']); // G1=70, G2=60
    expect(equityGap(stats)).toBe(10);
  });

  it('is null with fewer than two measured groups', () => {
    expect(equityGap(groupMeans({ A: 50 }, () => 'G1', ['G1', 'G2']))).toBeNull();
  });
});
