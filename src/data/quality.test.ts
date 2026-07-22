import { describe, it, expect } from 'vitest';
import {
  dedupeSubmissions,
  voidImpossibleCauses,
  hasImpossibleCauses,
  sanitizeRecords,
} from '../../etl/lib/quality.mjs';

/**
 * Guards against the two SFM ODK defects found on 2026-07-20 (see quality.mjs):
 * duplicate submissions double-counting, and a cause attribution that exceeded the
 * deaths it explained. Both silently distorted published figures, so the rules that
 * correct them are pinned here.
 */

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  state: 'Plateau',
  lga: 'Jos North',
  facility: 'Phc Jos Jarawa',
  month: 'Jun 2025',
  submittedAt: '2025-06-24T12:22:00.000+01:00',
  matDeaths: 0,
  matPPH: 0,
  matHTN: 0,
  matSepsis: 0,
  totalDeliveries: 0,
  ...over,
});

describe('hasImpossibleCauses', () => {
  it('flags a row attributing more causes than deaths', () => {
    expect(hasImpossibleCauses(row({ matDeaths: 4, matPPH: 14, matHTN: 3, matSepsis: 3 }))).toBe(true);
  });

  it('accepts causes equal to, or short of, the deaths', () => {
    expect(hasImpossibleCauses(row({ matDeaths: 4, matPPH: 4 }))).toBe(false);
    expect(hasImpossibleCauses(row({ matDeaths: 4, matPPH: 1, matHTN: 1 }))).toBe(false);
    expect(hasImpossibleCauses(row({ matDeaths: 0 }))).toBe(false);
  });
});

describe('dedupeSubmissions', () => {
  it('collapses byte-identical twins to a single row', () => {
    const r = row({ totalDeliveries: 11 });
    expect(dedupeSubmissions([r, { ...r }])).toHaveLength(1);
  });

  it('keeps the internally-consistent version when duplicates conflict', () => {
    // The real Phc Jos Jarawa case: version A is coherent, version B is not.
    const a = row({ matDeaths: 2, matPPH: 2 });
    const b = row({ matDeaths: 4, matPPH: 14, matHTN: 3, matSepsis: 3 });
    expect(dedupeSubmissions([a, b])[0]).toBe(a);
    // Order must not decide the winner.
    expect(dedupeSubmissions([b, a])[0]).toBe(a);
  });

  it('treats a different facility-month as a separate report', () => {
    const a = row({ month: 'Jun 2025' });
    const b = row({ month: 'Jul 2025' });
    expect(dedupeSubmissions([a, b])).toHaveLength(2);
  });

  it('treats a re-submission at a later timestamp as separate', () => {
    const a = row();
    const b = row({ submittedAt: '2025-06-25T09:00:00.000+01:00' });
    expect(dedupeSubmissions([a, b])).toHaveLength(2);
  });
});

describe('voidImpossibleCauses', () => {
  it('clears the attribution but preserves the death count', () => {
    const [out] = voidImpossibleCauses([row({ matDeaths: 4, matPPH: 14, matHTN: 3, matSepsis: 3 })]);
    expect(out.matDeaths).toBe(4);
    expect(out.matPPH).toBe(0);
    expect(out.matHTN).toBe(0);
    expect(out.matSepsis).toBe(0);
  });

  it('leaves valid rows untouched', () => {
    const r = row({ matDeaths: 4, matPPH: 2 });
    expect(voidImpossibleCauses([r])[0]).toBe(r);
  });
});

describe('sanitizeRecords', () => {
  it('reports what each guard acted on', () => {
    const a = row({ matDeaths: 2, matPPH: 2 });
    const b = row({ matDeaths: 4, matPPH: 14, matHTN: 3, matSepsis: 3 });
    const res = sanitizeRecords([a, b]);
    expect(res.records).toHaveLength(1);
    expect(res.dropped).toBe(1);
    // The bad row loses the dedupe, so nothing is left needing a void.
    expect(res.voided).toBe(0);
  });

  it('voids an impossible row that has no duplicate to lose to', () => {
    const res = sanitizeRecords([row({ matDeaths: 4, matPPH: 14 })]);
    expect(res.dropped).toBe(0);
    expect(res.voided).toBe(1);
    expect(res.records[0].matPPH).toBe(0);
    expect(res.records[0].matDeaths).toBe(4);
  });

  it('is a no-op on already-clean records', () => {
    const rows = [row({ matDeaths: 1, matPPH: 1 }), row({ month: 'Jul 2025', matDeaths: 2 })];
    const res = sanitizeRecords(rows);
    expect(res).toMatchObject({ dropped: 0, voided: 0 });
    expect(res.records).toHaveLength(2);
  });
});
