import { describe, expect, it } from 'vitest';
import { describeScores } from '../src/stats/descriptive.js';
import { computeSubjectStats } from '../src/stats/subject-stats.js';
import { summarizeStudent } from '../src/stats/student-summary.js';
import { makeStudent, SUBJECTS } from './helpers.js';

const tenths = (scores: number[]): number[] => scores.map((s) => Math.round(s * 10));

describe('describeScores', () => {
  it('母體標準差：[2,4,4,4,5,5,7,9] 平均 5、σ = 2', () => {
    const result = describeScores(tenths([2, 4, 4, 4, 5, 5, 7, 9]));

    expect(result?.mean).toBe(5);
    expect(result?.sd).toBeCloseTo(2, 10);
  });

  it('中位數：奇數取中間值，偶數取中間兩數平均', () => {
    expect(describeScores(tenths([70, 10, 90]))?.median).toBe(70);
    expect(describeScores(tenths([60, 10, 90, 75]))?.median).toBe(67.5);
  });

  it('最高、最低分與及格率（60 分含在及格內）', () => {
    const result = describeScores(tenths([59.9, 60, 100, 0]));

    expect(result).toMatchObject({ count: 4, max: 100, min: 0, passCount: 2, passRate: 0.5 });
  });

  it('沒有任何分數時回傳 null', () => {
    expect(describeScores([])).toBeNull();
  });
});

describe('computeSubjectStats', () => {
  it('30 人應考、2 人缺考、1 人 0 分 → 實考 28 人，平均分母為 28', () => {
    const scores: (number | 'x')[] = [...Array<number>(27).fill(70), 0, 'x', 'x'];
    const students = scores.map((s) => makeStudent({ 數學: s }));

    const [math] = computeSubjectStats(students, ['數學']);

    expect(math).toMatchObject({ subject: '數學', enrolled: 30, absent: 2, taken: 28 });
    // (27 × 70 + 0) / 28 = 67.5，若錯把缺考當 0 分會變成 63
    expect(math?.stats?.mean).toBe(67.5);
    expect(math?.stats?.min).toBe(0);
  });

  it('全部缺考時 stats 為 null，人數仍正確', () => {
    const [math] = computeSubjectStats([makeStudent({ 數學: 'x' })], ['數學']);

    expect(math).toEqual({ subject: '數學', enrolled: 1, absent: 1, taken: 0, stats: null });
  });
});

describe('summarizeStudent', () => {
  it('總分與平均只計入有應考的科目，並標示缺考科目數', () => {
    const student = makeStudent([90, 80, 'x', 70, 60, 'x', 85.5, 74.5]);

    const summary = summarizeStudent(student, SUBJECTS);

    // 90 + 80 + 70 + 60 + 85.5 + 74.5 = 460，6 科
    expect(summary).toMatchObject({ totalTenths: 4600, takenCount: 6, absentCount: 2 });
    expect(summary.average).toBeCloseTo(460 / 6, 10);
  });

  it('全部缺考時平均為 null', () => {
    const summary = summarizeStudent(makeStudent(SUBJECTS.map(() => 'x' as const)), SUBJECTS);

    expect(summary).toMatchObject({ totalTenths: 0, takenCount: 0, absentCount: 8, average: null });
  });
});
