import { describe, expect, it } from 'vitest';
import { buildReportModel } from '../src/report/model.js';
import type { ImportResult } from '../src/io/import-folder.js';
import type { StudentRecord } from '../src/domain/types.js';
import { makeStudent, SUBJECTS, uniform } from './helpers.js';

function imported(students: StudentRecord[], extra: Partial<ImportResult> = {}): ImportResult {
  return {
    files: ['701.csv', '702.csv'],
    students,
    issues: [],
    duplicateIds: new Set(),
    erroredIds: new Set(),
    erroredSeats: new Set(),
    ...extra,
  };
}

describe('buildReportModel', () => {
  const a = uniform(90, { studentId: 'A', className: '702', seat: '1' });
  const b = uniform(80, { studentId: 'B', className: '701', seat: '2' });
  const c = makeStudent([70, 70, 70, 70, 70, 70, 70, 'x'], { studentId: 'C', className: '701', seat: '1' });

  it('依班級分組並依座號排序，班級本身也排序', () => {
    const model = buildReportModel({ current: imported([a, b, c]), previous: null, subjects: SUBJECTS });

    expect(model.classes.map((k) => [k.className, k.students.map((s) => s.student.studentId)])).toEqual([
      ['701', ['C', 'B']],
      ['702', ['A']],
    ]);
    expect(model.studentCount).toBe(3);
  });

  it('學生列帶有名次與 PR；有缺考者沒有名次', () => {
    const model = buildReportModel({ current: imported([a, b, c]), previous: null, subjects: SUBJECTS });
    const rows = new Map(model.classes.flatMap((k) => k.students).map((s) => [s.student.studentId, s]));

    expect(rows.get('A')?.rank).toEqual({ rank: 1, pr: 75 });
    expect(rows.get('C')?.rank).toBeNull();
    expect(model.ranking.excluded.map((s) => s.student.studentId)).toEqual(['C']);
  });

  it('標示學號重複的學生', () => {
    const model = buildReportModel({
      current: imported([a, b], { duplicateIds: new Set(['B']) }),
      previous: null,
      subjects: SUBJECTS,
    });
    const flagged = model.classes.flatMap((k) => k.students).filter((s) => s.isDuplicateId);

    expect(flagged.map((s) => s.student.studentId)).toEqual(['B']);
  });

  it('有上次資料時才產生比較結果', () => {
    const withoutPrev = buildReportModel({ current: imported([a]), previous: null, subjects: SUBJECTS });
    const withPrev = buildReportModel({
      current: imported([a]),
      previous: imported([uniform(80, { studentId: 'A' })]),
      subjects: SUBJECTS,
    });

    expect(withoutPrev.comparison).toBeNull();
    expect(withPrev.comparison?.improved[0]?.delta).toBe(10);
  });
});
