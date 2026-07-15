import { describe, it, expect } from 'vitest';
import {
  goodnessFor,
  statusFor,
  linregress,
  trendDelta,
  monthlyToQuarterly,
  monthlyToYearly,
  looksLikePercent,
  scopeLabel,
} from './calculations';
import { EMPTY_FILTER } from '@/store/filterStore';

describe('goodnessFor', () => {
  it('returns pct as-is for normal indicators and flips inverse ones', () => {
    expect(goodnessFor({ inverse: false, pct: 70 })).toBe(70);
    expect(goodnessFor({ inverse: true, pct: 70 })).toBe(30);
  });
});

describe('statusFor', () => {
  it('bands a normal value into good/fair/poor', () => {
    expect(statusFor(80).level).toBe('good');
    expect(statusFor(50).level).toBe('mid');
    expect(statusFor(20).level).toBe('poor');
  });

  it('inverts the banding for inverse indicators (lower is better)', () => {
    expect(statusFor(20, true).level).toBe('good');
    expect(statusFor(50, true).level).toBe('mid');
    expect(statusFor(80, true).level).toBe('poor');
  });
});

describe('linregress', () => {
  it('fits a straight line through clean points', () => {
    expect(linregress([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it('leaves gaps as gaps and returns all-null for < 2 finite points', () => {
    const out = linregress([2, null, 6]);
    expect(out[1]).toBeNull(); // gap preserved
    expect(out[0]).toBeCloseTo(2, 5);
    expect(out[2]).toBeCloseTo(6, 5);
    expect(linregress([null, 5])).toEqual([null, null]); // only one finite point
  });
});

describe('trendDelta', () => {
  it('reports a percentage-point delta for a pct series', () => {
    const { delta, dir } = trendDelta([40, 45, 50], true);
    expect(delta).toBe('+10 pts over period');
    expect(dir).toBe('up');
  });

  it('reports a percent-change delta for a count series and marks direction', () => {
    const { delta, dir } = trendDelta([200, 150], false);
    expect(delta).toBe('-25% over period');
    expect(dir).toBe('down');
  });

  it('falls back to "Live" with fewer than two points', () => {
    expect(trendDelta([42]).delta).toBe('Live');
    expect(trendDelta(undefined).delta).toBe('Live');
  });
});

describe('granularity roll-ups', () => {
  it('averages / sums three months into a quarter', () => {
    const monthly = [10, 20, 30, ...Array(39).fill(null)];
    expect(monthlyToQuarterly(monthly, 'mean')[0]).toBe(20);
    expect(monthlyToQuarterly(monthly, 'sum')[0]).toBe(60);
  });

  it('rolls the 42-month window into four years and nulls empty groups', () => {
    const monthly = [...Array(12).fill(5), ...Array(30).fill(null)];
    const yearly = monthlyToYearly(monthly, 'mean');
    expect(yearly[0]).toBe(5);
    expect(yearly[1]).toBeNull();
  });
});

describe('looksLikePercent', () => {
  it('recognises percent-formatted strings only', () => {
    expect(looksLikePercent('74%')).toBe(true);
    expect(looksLikePercent('-3.5%')).toBe(true);
    expect(looksLikePercent('₦2.1bn')).toBe(false);
    expect(looksLikePercent('612 vs 880')).toBe(false);
  });
});

describe('scopeLabel', () => {
  it('leads with the tightest active geography and joins the rest', () => {
    expect(scopeLabel({ ...EMPTY_FILTER, state: 'Kano', donor: 'GAVI', month: 'June', year: '2026' })).toBe(
      'Kano · GAVI · June 2026'
    );
    expect(scopeLabel({ ...EMPTY_FILTER, lga: 'Nassarawa', state: 'Kano' })).toBe('Nassarawa');
    expect(scopeLabel(EMPTY_FILTER)).toBe('');
  });
});
