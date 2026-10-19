import type { StudentRecord, SubjectName } from '../domain/types.js';
import { describeScores, type Descriptive } from './descriptive.js';

export interface SubjectStats {
  subject: SubjectName;
  /** 應考人數：成功匯入的學生（含缺考）。 */
  enrolled: number;
  absent: number;
  /** 實考人數 = 應考 − 缺考，也是平均的分母。 */
  taken: number;
  stats: Descriptive | null;
}

export function computeSubjectStats(
  students: readonly StudentRecord[],
  subjects: readonly SubjectName[],
): SubjectStats[] {
  return subjects.map((subject) => {
    const present: number[] = [];
    let absent = 0;
    for (const student of students) {
      const score = student.scores.get(subject);
      if (score?.kind === 'present') present.push(score.tenths);
      else absent++;
    }
    return {
      subject,
      enrolled: students.length,
      absent,
      taken: present.length,
      stats: describeScores(present),
    };
  });
}

export function groupByClass(students: readonly StudentRecord[]): Map<string, StudentRecord[]> {
  const groups = new Map<string, StudentRecord[]>();
  const sorted = [...students].sort((a, b) =>
    a.className === b.className ? Number(a.seat) - Number(b.seat) : a.className < b.className ? -1 : 1,
  );
  for (const student of sorted) {
    const group = groups.get(student.className) ?? [];
    group.push(student);
    groups.set(student.className, group);
  }
  return groups;
}
