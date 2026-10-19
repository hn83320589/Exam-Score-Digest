import type { ImportIssue, SubjectName } from '../domain/types.js';
import type { ImportResult } from '../io/import-folder.js';
import { compareExams, type ComparisonResult } from '../stats/compare.js';
import { computeDistribution, type SubjectDistribution } from '../stats/distribution.js';
import { rankStudents, type RankingResult, type RankPr } from '../stats/ranking.js';
import { summarizeStudent, type StudentSummary } from '../stats/student-summary.js';
import { computeSubjectStats, groupByClass, type SubjectStats } from '../stats/subject-stats.js';

export interface StudentRow extends StudentSummary {
  /** 有缺考科目時為 null（不參與排名）。 */
  rank: RankPr | null;
  isDuplicateId: boolean;
}

export interface ClassReport {
  className: string;
  students: StudentRow[];
  subjects: SubjectStats[];
}

/** 完整版報表的資料，含個人資料；公開版請改用 redact 後的 PublicReportModel。 */
export interface ReportModel {
  subjects: SubjectName[];
  files: string[];
  studentCount: number;
  grade: SubjectStats[];
  classes: ClassReport[];
  distribution: SubjectDistribution[];
  ranking: RankingResult;
  comparison: ComparisonResult | null;
  issues: ImportIssue[];
  previousIssues: ImportIssue[] | null;
}

export interface ReportInput {
  current: ImportResult;
  previous: ImportResult | null;
  subjects: readonly SubjectName[];
}

export function buildReportModel({ current, previous, subjects }: ReportInput): ReportModel {
  const summaries = current.students.map((s) => summarizeStudent(s, subjects));
  const ranking = rankStudents(summaries);
  const rankById = new Map(ranking.ranked.map((r) => [r.student.studentId, { rank: r.rank, pr: r.pr }]));
  const summaryById = new Map(summaries.map((s) => [s.student.studentId, s]));

  const toRow = (summary: StudentSummary): StudentRow => ({
    ...summary,
    rank: rankById.get(summary.student.studentId) ?? null,
    isDuplicateId: current.duplicateIds.has(summary.student.studentId),
  });

  const classes = [...groupByClass(current.students)].map(([className, students]): ClassReport => ({
    className,
    students: students.map((s) => {
      const summary = summaryById.get(s.studentId);
      if (summary === undefined) throw new Error(`找不到學號 ${s.studentId} 的個人統計`);
      return toRow(summary);
    }),
    subjects: computeSubjectStats(students, subjects),
  }));

  const comparison =
    previous === null
      ? null
      : compareExams(
          summaries,
          previous.students.map((s) => summarizeStudent(s, subjects)),
          { currentErroredIds: current.erroredIds, previousErroredIds: previous.erroredIds },
        );

  return {
    subjects: [...subjects],
    files: current.files,
    studentCount: current.students.length,
    grade: computeSubjectStats(current.students, subjects),
    classes,
    distribution: computeDistribution(current.students, subjects),
    ranking,
    comparison,
    issues: current.issues,
    previousIssues: previous?.issues ?? null,
  };
}
