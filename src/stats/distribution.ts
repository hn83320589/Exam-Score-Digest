import type { StudentRecord, SubjectName } from '../domain/types.js';

export interface Bin {
  label: string;
  /** 明確的邊界說明，例如「80 ≤ 分數 < 90」。 */
  range: string;
}

const BIN_COUNT = 10;

export const BINS: readonly Bin[] = Array.from({ length: BIN_COUNT }, (_, i) => {
  const low = i * 10;
  const isLast = i === BIN_COUNT - 1;
  return isLast
    ? { label: `${low}–100`, range: `${low} ≤ 分數 ≤ 100` }
    : { label: `${low}–${low + 9}`, range: `${low} ≤ 分數 < ${low + 10}` };
});

/** 以十分位計：0–99 → 第 0 級 … 900–1000 → 第 9 級（100 分併入最後一級）。 */
export function binIndex(tenths: number): number {
  return Math.min(Math.floor(tenths / 100), BIN_COUNT - 1);
}

export interface SubjectDistribution {
  subject: SubjectName;
  counts: number[];
}

export function computeDistribution(
  students: readonly StudentRecord[],
  subjects: readonly SubjectName[],
): SubjectDistribution[] {
  return subjects.map((subject) => {
    const counts = Array<number>(BIN_COUNT).fill(0);
    for (const student of students) {
      const score = student.scores.get(subject);
      if (score?.kind !== 'present') continue;
      const index = binIndex(score.tenths);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    return { subject, counts };
  });
}
