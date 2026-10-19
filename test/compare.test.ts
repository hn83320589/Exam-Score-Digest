import { describe, expect, it } from 'vitest';
import { compareExams } from '../src/stats/compare.js';
import { summarizeStudent } from '../src/stats/student-summary.js';
import { makeStudent, SUBJECTS, uniform, type ScoreInput } from './helpers.js';

const summarize = (score: ScoreInput, studentId: string) => summarizeStudent(uniform(score, { studentId }), SUBJECTS);
const NO_ERRORS = { currentErroredIds: new Set<string>(), previousErroredIds: new Set<string>() };

describe('compareExams', () => {
  // 學生 s00…s24，上次都是 50 分，本次分別是 38…62 分（差值 −12 … +12）
  const ids = Array.from({ length: 25 }, (_, i) => `s${String(i).padStart(2, '0')}`);
  const previous = ids.map((id) => summarize(50, id));
  const current = ids.map((id, i) => summarize(38 + i, id));

  it('進步前 10 名依進步幅度由大到小', () => {
    const result = compareExams(current, previous, NO_ERRORS);

    expect(result.improved.map((e) => [e.current.student.studentId, e.delta])).toEqual(
      Array.from({ length: 10 }, (_, k) => [`s${24 - k}`, 12 - k]),
    );
  });

  it('退步前 10 名依退步幅度由大到小', () => {
    const result = compareExams(current, previous, NO_ERRORS);

    expect(result.declined.map((e) => [e.current.student.studentId, e.delta])).toEqual(
      Array.from({ length: 10 }, (_, k) => [`s${String(k).padStart(2, '0')}`, -12 + k]),
    );
  });

  it('進步榜只列分數真的提高的學生，不足 10 人就列出實際人數', () => {
    const result = compareExams([summarize(60, 'a'), summarize(50, 'b')], [summarize(55, 'a'), summarize(50, 'b')], NO_ERRORS);

    expect(result.improved.map((e) => e.current.student.studentId)).toEqual(['a']);
    expect(result.declined).toEqual([]);
    expect(result.comparedCount).toBe(2);
  });

  it('同樣進步幅度時依學號排序，結果固定', () => {
    const result = compareExams(
      [summarize(60, 'b'), summarize(60, 'a')],
      [summarize(50, 'b'), summarize(50, 'a')],
      NO_ERRORS,
    );

    expect(result.improved.map((e) => e.current.student.studentId)).toEqual(['a', 'b']);
  });

  it('只在本次出現標示為轉入、只在上次出現標示為轉出，皆不列入比較', () => {
    const result = compareExams(
      [summarize(70, 'stay'), summarize(99, 'new')],
      [summarize(60, 'stay'), summarize(10, 'gone')],
      NO_ERRORS,
    );

    expect(result.transferredIn.map((s) => s.student.studentId)).toEqual(['new']);
    expect(result.transferredOut.map((s) => s.student.studentId)).toEqual(['gone']);
    expect(result.comparedCount).toBe(1);
    expect(result.improved.map((e) => e.current.student.studentId)).toEqual(['stay']);
  });

  it('另一次的資料因錯誤被跳過時，標示為無法比較而不是轉學', () => {
    const result = compareExams([summarize(70, 'err-prev')], [summarize(60, 'err-now')], {
      currentErroredIds: new Set(['err-now']),
      previousErroredIds: new Set(['err-prev']),
    });

    expect(result.transferredIn).toEqual([]);
    expect(result.transferredOut).toEqual([]);
    expect(result.unmatched.map((u) => [u.summary.student.studentId, u.exam])).toEqual([
      ['err-prev', 'current'],
      ['err-now', 'previous'],
    ]);
  });

  it('有缺考的學生以實考科目平均比較（依決議全部納入）', () => {
    const now = summarizeStudent(makeStudent([80, 80, 80, 80, 80, 80, 80, 'x'], { studentId: 'a' }), SUBJECTS);

    const result = compareExams([now], [summarize(70, 'a')], NO_ERRORS);

    expect(result.improved[0]).toMatchObject({ delta: 10 });
    expect(result.improved[0]?.current.absentCount).toBe(1);
  });
});
