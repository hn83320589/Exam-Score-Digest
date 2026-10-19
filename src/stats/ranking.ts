import type { StudentSummary } from './student-summary.js';

export interface RankPr {
  rank: number;
  pr: number;
}

export interface RankedStudent extends StudentSummary, RankPr {}

export interface RankingResult {
  /** 依名次排序；同名次依學號排序。 */
  ranked: RankedStudent[];
  /** 有任何科目缺考，不參與排名與 PR。 */
  excluded: StudentSummary[];
}

const PR_MIN = 1;
const PR_MAX = 99;

/** PR = 100 × (低於人數 + 0.5 × 同分人數) / 總人數，四捨五入後限制在 1–99。 */
export function percentileRank(below: number, same: number, total: number): number {
  const pr = Math.round((100 * (2 * below + same)) / (2 * total));
  return Math.min(PR_MAX, Math.max(PR_MIN, pr));
}

/**
 * 競賽式排名（1、2、2、4）。分數必須可精確比較，呼叫端應傳入整數。
 * 回傳陣列與輸入順序對應。
 */
export function rankScores(scores: readonly number[]): RankPr[] {
  const counts = new Map<number, number>();
  for (const s of scores) counts.set(s, (counts.get(s) ?? 0) + 1);

  return scores.map((score) => {
    let above = 0;
    let below = 0;
    for (const [value, n] of counts) {
      if (value > score) above += n;
      else if (value < score) below += n;
    }
    return { rank: above + 1, pr: percentileRank(below, counts.get(score) ?? 0, scores.length) };
  });
}

/**
 * 只有八科全部應考的學生參與排名，此時「平均分數」的排序等同十分位總分的排序，
 * 以整數比較即可完全避免浮點誤差造成同分不同名次。
 */
export function rankStudents(summaries: readonly StudentSummary[]): RankingResult {
  const eligible = summaries.filter((s) => s.absentCount === 0);
  const excluded = summaries.filter((s) => s.absentCount > 0);
  const ranks = rankScores(eligible.map((s) => s.totalTenths));

  const ranked = ranks
    .map((rankPr, i): RankedStudent => {
      const summary = eligible[i];
      if (summary === undefined) throw new Error(`排名結果與學生數不一致（第 ${i} 筆）`);
      return { ...summary, ...rankPr };
    })
    .sort((a, b) => a.rank - b.rank || compareId(a, b));
  return { ranked, excluded: [...excluded].sort(compareId) };
}

function compareId(a: StudentSummary, b: StudentSummary): number {
  return a.student.studentId < b.student.studentId ? -1 : a.student.studentId > b.student.studentId ? 1 : 0;
}
