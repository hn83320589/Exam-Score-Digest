export type SubjectName = string;

/** 分數一律以整數十分位儲存（85.5 → 855），避免浮點誤差影響同分判定。 */
export type Score = { kind: 'present'; tenths: number } | { kind: 'absent' };

export type ParsedScore = Score | { kind: 'invalid'; reason: string };

export interface SourceRef {
  file: string;
  row: number;
}

export interface StudentRecord {
  studentId: string;
  className: string;
  seat: string;
  name: string;
  scores: ReadonlyMap<SubjectName, Score>;
  source: SourceRef;
}

export type ImportIssueKind =
  | 'file-error'
  | 'unknown-column'
  | 'missing-id'
  | 'missing-class'
  | 'invalid-score'
  | 'duplicate-id';

export interface ImportIssue {
  kind: ImportIssueKind;
  file: string;
  /** 檔案層級的問題（例如無法讀取）沒有列號。 */
  row?: number;
  studentId?: string;
  /** 重複學號時，另一個來源的位置。 */
  related?: SourceRef[];
  message: string;
}
