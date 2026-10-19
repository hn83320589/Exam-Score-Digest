import { describe, expect, it } from 'vitest';
import { dedupeStudents } from '../src/domain/dedupe.js';
import type { StudentRecord } from '../src/domain/types.js';

function student(studentId: string, file: string, row: number): StudentRecord {
  return { studentId, className: file.slice(0, 3), seat: '1', name: '某生', scores: new Map(), source: { file, row } };
}

describe('dedupeStudents', () => {
  it('跨檔重複學號：保留先出現的一筆，問題清單列出兩個來源檔案與列號', () => {
    const result = dedupeStudents([
      student('1120001', '701.csv', 2),
      student('1120002', '701.csv', 3),
      student('1120001', '705.xlsx', 9),
    ]);

    expect(result.students.map((s) => s.source)).toEqual([
      { file: '701.csv', row: 2 },
      { file: '701.csv', row: 3 },
    ]);
    expect([...result.duplicateIds]).toEqual(['1120001']);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: 'duplicate-id',
        file: '705.xlsx',
        row: 9,
        studentId: '1120001',
        related: [{ file: '701.csv', row: 2 }],
      }),
    ]);
    expect(result.issues[0]?.message).toContain('701.csv');
  });

  it('沒有重複時原樣回傳', () => {
    const input = [student('1', 'a.csv', 2), student('2', 'a.csv', 3)];

    expect(dedupeStudents(input)).toEqual({ students: input, issues: [], duplicateIds: new Set() });
  });
});
