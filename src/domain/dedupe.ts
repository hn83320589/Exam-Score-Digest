import type { ImportIssue, StudentRecord } from './types.js';

export interface DedupeResult {
  students: StudentRecord[];
  issues: ImportIssue[];
  /** 有重複的學號；保留下來的那筆在報表中要標示。 */
  duplicateIds: ReadonlySet<string>;
}

/** 學號是唯一身分依據。依輸入順序（檔名、列號）保留第一筆，之後的重複列跳過並列入問題清單。 */
export function dedupeStudents(students: readonly StudentRecord[]): DedupeResult {
  const kept = new Map<string, StudentRecord>();
  const issues: ImportIssue[] = [];
  const duplicateIds = new Set<string>();

  for (const student of students) {
    const first = kept.get(student.studentId);
    if (first === undefined) {
      kept.set(student.studentId, student);
      continue;
    }
    duplicateIds.add(student.studentId);
    issues.push({
      kind: 'duplicate-id',
      ...student.source,
      studentId: student.studentId,
      classSeat: { className: student.className, seat: student.seat },
      related: [first.source],
      message: `學號 ${student.studentId} 與 ${first.source.file} 第 ${first.source.row} 列重複，已跳過此列（保留先出現的資料）`,
    });
  }

  return { students: [...kept.values()], issues, duplicateIds };
}
