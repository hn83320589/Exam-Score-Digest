import { describe, expect, it } from 'vitest';
import { percentileRank, rankScores, rankStudents } from '../src/stats/ranking.js';
import { summarizeStudent } from '../src/stats/student-summary.js';
import { makeStudent, SUBJECTS, uniform } from './helpers.js';

describe('rankScores：同分同名次，下一名次跳號', () => {
  it('[90, 85, 85, 80] → 1、2、2、4', () => {
    expect(rankScores([90, 85, 85, 80]).map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it('輸入順序不影響結果', () => {
    expect(rankScores([80, 85, 90, 85]).map((r) => r.rank)).toEqual([4, 2, 1, 2]);
  });

  it('三人同分後跳兩號：[100, 90, 90, 90, 70] → 1、2、2、2、5', () => {
    expect(rankScores([100, 90, 90, 90, 70]).map((r) => r.rank)).toEqual([1, 2, 2, 2, 5]);
  });
});

describe('percentileRank：PR = 100 × (低於人數 + 0.5 × 同分人數) / 總人數', () => {
  it('手算：[90, 85, 85, 80]', () => {
    // 90：(3 + 0.5×1)/4 = 87.5 → 88
    // 85：(1 + 0.5×2)/4 = 50
    // 80：(0 + 0.5×1)/4 = 12.5 → 13（四捨五入）
    expect(rankScores([90, 85, 85, 80]).map((r) => r.pr)).toEqual([88, 50, 50, 13]);
  });

  it('上限 99：1000 人中的第一名算出 99.95，取 99', () => {
    expect(percentileRank(999, 1, 1000)).toBe(99);
  });

  it('下限 1：200 人中的最後一名算出 0.25，取 1', () => {
    expect(percentileRank(0, 1, 200)).toBe(1);
  });

  it('全部同分時名次都是 1、PR 都是 50', () => {
    expect(rankScores([70, 70, 70])).toEqual([
      { rank: 1, pr: 50 },
      { rank: 1, pr: 50 },
      { rank: 1, pr: 50 },
    ]);
  });
});

describe('rankStudents', () => {
  it('有任何科目缺考的學生不參與排名與 PR，另外列出', () => {
    const a = uniform(90);
    const b = uniform(80);
    const absent = makeStudent([100, 100, 100, 100, 100, 100, 100, 'x']);

    const result = rankStudents([a, b, absent].map((s) => summarizeStudent(s, SUBJECTS)));

    expect(result.ranked.map((r) => [r.student.studentId, r.rank, r.pr])).toEqual([
      [a.studentId, 1, 75],
      [b.studentId, 2, 25],
    ]);
    expect(result.excluded.map((s) => s.student.studentId)).toEqual([absent.studentId]);
  });

  it('平均分數只差 0.0125 也能精確區分（十分位整數比較，不受浮點誤差影響）', () => {
    const a = makeStudent([85.1, 85.2, 80, 80, 80, 80, 80, 80]);
    const b = makeStudent([85.3, 85, 80, 80, 80, 80, 80, 80]);
    const c = makeStudent([85.2, 85, 80, 80, 80, 80, 80, 80]);

    const result = rankStudents([a, b, c].map((s) => summarizeStudent(s, SUBJECTS)));

    expect(result.ranked.map((r) => [r.student.studentId, r.rank])).toEqual([
      [a.studentId, 1],
      [b.studentId, 1],
      [c.studentId, 3],
    ]);
  });
});
