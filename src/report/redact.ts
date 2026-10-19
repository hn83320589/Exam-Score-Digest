import type { SubjectName } from '../domain/types.js';
import type { SubjectDistribution } from '../stats/distribution.js';
import type { SubjectStats } from '../stats/subject-stats.js';
import type { ReportModel } from './model.js';

export interface PublicClassSummary {
  className: string;
  studentCount: number;
  subjects: SubjectStats[];
}

/**
 * 公開版報表的資料。型別上就不含任何姓名、學號或個人分數，
 * 公開版 renderer 只接受這個型別，因此不可能意外輸出個人資料。
 */
export interface PublicReportModel {
  subjects: SubjectName[];
  studentCount: number;
  grade: SubjectStats[];
  classes: PublicClassSummary[];
  distribution: SubjectDistribution[];
  rankedCount: number;
  excludedCount: number;
}

export function toPublicModel(model: ReportModel): PublicReportModel {
  return {
    subjects: [...model.subjects],
    studentCount: model.studentCount,
    grade: model.grade,
    classes: model.classes.map((k) => ({
      className: k.className,
      studentCount: k.students.length,
      subjects: k.subjects,
    })),
    distribution: model.distribution,
    rankedCount: model.ranking.ranked.length,
    excludedCount: model.ranking.excluded.length,
  };
}

const VISIBLE_DIGITS = 3;

/** 學號只顯示末三碼，例如 1120715 → ****715。 */
export function maskStudentId(studentId: string): string {
  if (studentId.length <= VISIBLE_DIGITS) return '*'.repeat(studentId.length);
  return '*'.repeat(studentId.length - VISIBLE_DIGITS) + studentId.slice(-VISIBLE_DIGITS);
}
