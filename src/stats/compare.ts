import type { StudentSummary } from './student-summary.js';

export const TOP_MOVERS = 10;

export interface ComparisonEntry {
  current: StudentSummary;
  previous: StudentSummary;
  /** 本次平均 − 上次平均（分）。 */
  delta: number;
}

export interface UnmatchedStudent {
  summary: StudentSummary;
  /** 該生出現在哪一次段考。 */
  exam: 'current' | 'previous';
  reason: string;
}

export interface ComparisonResult {
  comparedCount: number;
  improved: ComparisonEntry[];
  declined: ComparisonEntry[];
  transferredIn: StudentSummary[];
  transferredOut: StudentSummary[];
  unmatched: UnmatchedStudent[];
}

export interface CompareOptions {
  /** 本次段考中因資料錯誤被跳過的學號。 */
  currentErroredIds: ReadonlySet<string>;
  previousErroredIds: ReadonlySet<string>;
}

interface Fraction {
  numerator: number;
  denominator: number;
}

/** 平均差值以分數（整數分子／分母）表示，排序時交叉相乘即可精確比較。 */
function deltaFraction(current: StudentSummary, previous: StudentSummary): Fraction {
  return {
    numerator: current.totalTenths * previous.takenCount - previous.totalTenths * current.takenCount,
    denominator: current.takenCount * previous.takenCount,
  };
}

function compareFractions(a: Fraction, b: Fraction): number {
  return a.numerator * b.denominator - b.numerator * a.denominator;
}

const byId = (a: StudentSummary, b: StudentSummary): number =>
  a.student.studentId < b.student.studentId ? -1 : a.student.studentId > b.student.studentId ? 1 : 0;

export function compareExams(
  current: readonly StudentSummary[],
  previous: readonly StudentSummary[],
  options: CompareOptions,
): ComparisonResult {
  const previousById = new Map(previous.map((s) => [s.student.studentId, s]));
  const currentIds = new Set(current.map((s) => s.student.studentId));

  const pairs: { entry: ComparisonEntry; fraction: Fraction }[] = [];
  const transferredIn: StudentSummary[] = [];
  const unmatched: UnmatchedStudent[] = [];

  for (const now of current) {
    const before = previousById.get(now.student.studentId);
    if (before === undefined) {
      if (options.previousErroredIds.has(now.student.studentId)) {
        unmatched.push({ summary: now, exam: 'current', reason: '上次段考的資料有錯誤而未匯入，無法比較' });
      } else {
        transferredIn.push(now);
      }
    } else if (now.takenCount === 0 || before.takenCount === 0) {
      unmatched.push({ summary: now, exam: 'current', reason: '其中一次段考全科缺考，無法比較' });
    } else {
      const fraction = deltaFraction(now, before);
      pairs.push({
        entry: { current: now, previous: before, delta: fraction.numerator / fraction.denominator / 10 },
        fraction,
      });
    }
  }

  const transferredOut: StudentSummary[] = [];
  for (const before of previous) {
    if (currentIds.has(before.student.studentId)) continue;
    if (options.currentErroredIds.has(before.student.studentId)) {
      unmatched.push({ summary: before, exam: 'previous', reason: '本次段考的資料有錯誤而未匯入，無法比較' });
    } else {
      transferredOut.push(before);
    }
  }

  const sortedDesc = [...pairs].sort(
    (a, b) => compareFractions(b.fraction, a.fraction) || byId(a.entry.current, b.entry.current),
  );
  const sortedAsc = [...pairs].sort(
    (a, b) => compareFractions(a.fraction, b.fraction) || byId(a.entry.current, b.entry.current),
  );

  return {
    comparedCount: pairs.length,
    improved: sortedDesc.filter((p) => p.fraction.numerator > 0).slice(0, TOP_MOVERS).map((p) => p.entry),
    declined: sortedAsc.filter((p) => p.fraction.numerator < 0).slice(0, TOP_MOVERS).map((p) => p.entry),
    transferredIn: transferredIn.sort(byId),
    transferredOut: transferredOut.sort(byId),
    unmatched,
  };
}
