export const PASS_TENTHS = 600;

/** 所有值的單位為「分」；計算時使用十分位整數以避免累加誤差。 */
export interface Descriptive {
  count: number;
  mean: number;
  median: number;
  /** 母體標準差（除以 N），等同 Excel STDEV.P。 */
  sd: number;
  max: number;
  min: number;
  passCount: number;
  passRate: number;
}

export function describeScores(tenths: readonly number[]): Descriptive | null {
  const count = tenths.length;
  if (count === 0) return null;

  const sorted = [...tenths].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const meanTenths = sum / count;
  const variance = sorted.reduce((acc, v) => acc + (v - meanTenths) ** 2, 0) / count;
  const mid = Math.floor(count / 2);
  const medianTenths =
    count % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  const passCount = sorted.filter((v) => v >= PASS_TENTHS).length;

  return {
    count,
    mean: meanTenths / 10,
    median: medianTenths / 10,
    sd: Math.sqrt(variance) / 10,
    max: (sorted[count - 1] ?? 0) / 10,
    min: (sorted[0] ?? 0) / 10,
    passCount,
    passRate: passCount / count,
  };
}
