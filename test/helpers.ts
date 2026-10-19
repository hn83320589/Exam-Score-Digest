import type { Score, StudentRecord } from '../src/domain/types.js';

export const SUBJECTS = ['國文', '英語', '數學', '自然', '歷史', '地理', '公民', '健康'];

/** 'x' 代表缺考，其餘為分數（可含一位小數）。 */
export type ScoreInput = number | 'x';

export function toScore(value: ScoreInput): Score {
  return value === 'x' ? { kind: 'absent' } : { kind: 'present', tenths: Math.round(value * 10) };
}

let nextId = 1;

export function makeStudent(
  scores: ScoreInput[] | Record<string, ScoreInput>,
  overrides: Partial<Omit<StudentRecord, 'scores'>> = {},
): StudentRecord {
  const entries = Array.isArray(scores)
    ? SUBJECTS.map((subject, i): [string, Score] => [subject, toScore(scores[i] ?? 'x')])
    : Object.entries(scores).map(([subject, v]): [string, Score] => [subject, toScore(v)]);
  const id = String(nextId++).padStart(7, '0');
  return {
    studentId: id,
    className: '701',
    seat: '1',
    name: `學生${id}`,
    scores: new Map(entries),
    source: { file: '701.csv', row: 2 },
    ...overrides,
  };
}

/** 八科同分的學生。 */
export function uniform(score: ScoreInput, overrides: Partial<Omit<StudentRecord, 'scores'>> = {}): StudentRecord {
  return makeStudent(SUBJECTS.map(() => score), overrides);
}
