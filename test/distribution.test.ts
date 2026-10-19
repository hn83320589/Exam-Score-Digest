import { describe, expect, it } from 'vitest';
import { binIndex, BINS, computeDistribution } from '../src/stats/distribution.js';
import { makeStudent } from './helpers.js';

describe('binIndex：10 分一級距', () => {
  it.each([
    [0, 0],
    [9.9, 0],
    [10, 1],
    [59.9, 5],
    [60, 6],
    [89.9, 8],
    [90, 9],
    [100, 9],
  ])('%d 分 → 第 %i 級', (score, index) => {
    expect(binIndex(Math.round(score * 10))).toBe(index);
  });

  it('100 分歸入 90–100、89.9 分歸入 80–89', () => {
    expect(BINS[binIndex(1000)]?.label).toBe('90–100');
    expect(BINS[binIndex(899)]?.label).toBe('80–89');
  });

  it('級距標示清楚的邊界：最後一級包含 100', () => {
    expect(BINS).toHaveLength(10);
    expect(BINS[0]?.range).toBe('0 ≤ 分數 < 10');
    expect(BINS[8]?.range).toBe('80 ≤ 分數 < 90');
    expect(BINS[9]?.range).toBe('90 ≤ 分數 ≤ 100');
  });
});

describe('computeDistribution', () => {
  it('每科統計各級距人數，缺考不計入', () => {
    const students = [100, 95, 89.9, 0, 'x' as const].map((s) => makeStudent({ 數學: s }));

    const [math] = computeDistribution(students, ['數學']);

    expect(math?.subject).toBe('數學');
    expect(math?.counts).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1, 2]);
  });
});
