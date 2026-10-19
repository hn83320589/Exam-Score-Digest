export type SubjectName = string;

/** 分數一律以整數十分位儲存（85.5 → 855），避免浮點誤差影響同分判定。 */
export type Score = { kind: 'present'; tenths: number } | { kind: 'absent' };

export type ParsedScore = Score | { kind: 'invalid'; reason: string };
