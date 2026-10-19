import type { StudentRecord, SubjectName } from '../domain/types.js';

export interface StudentSummary {
  student: StudentRecord;
  totalTenths: number;
  takenCount: number;
  absentCount: number;
  /** 只計入有應考的科目；全部缺考時為 null。 */
  average: number | null;
}

export function summarizeStudent(student: StudentRecord, subjects: readonly SubjectName[]): StudentSummary {
  let totalTenths = 0;
  let takenCount = 0;
  for (const subject of subjects) {
    const score = student.scores.get(subject);
    if (score?.kind === 'present') {
      totalTenths += score.tenths;
      takenCount++;
    }
  }
  return {
    student,
    totalTenths,
    takenCount,
    absentCount: subjects.length - takenCount,
    average: takenCount === 0 ? null : totalTenths / takenCount / 10,
  };
}
