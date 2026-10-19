import { classSeatKey } from '../domain/types.js';
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
  /** 因資料錯誤被跳過的學號。 */
  currentErroredIds: ReadonlySet<string>;
  previousErroredIds: ReadonlySet<string>;
  /** 因資料錯誤被跳過的列之班級與座號（classSeatKey）。 */
  currentErroredSeats: ReadonlySet<string>;
  previousErroredSeats: ReadonlySet<string>;
}

/**
 * 學號只在一次段考出現時，判斷是否其實是另一次的資料錯誤（而非轉學）。
 * 回傳無法比較的原因；確實是轉學時回傳 null。
 */
function erroredInOther(
  summary: StudentSummary,
  otherLabel: string,
  erroredIds: ReadonlySet<string>,
  erroredSeats: ReadonlySet<string>,
): string | null {
  if (erroredIds.has(summary.student.studentId)) {
    return `${otherLabel}段考的資料有錯誤而未匯入，無法比較`;
  }
  if (erroredSeats.has(classSeatKey(summary.student))) {
    return `${otherLabel}段考同班同座號的資料列有錯誤（可能是學號空白或誤植），無法比較`;
  }
  return null;
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
      const reason = erroredInOther(now, '上次', options.previousErroredIds, options.previousErroredSeats);
      if (reason === null) transferredIn.push(now);
      else unmatched.push({ summary: now, exam: 'current', reason });
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
    const reason = erroredInOther(before, '本次', options.currentErroredIds, options.currentErroredSeats);
    if (reason === null) transferredOut.push(before);
    else unmatched.push({ summary: before, exam: 'previous', reason });
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
