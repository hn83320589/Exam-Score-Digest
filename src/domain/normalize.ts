import type { DigestConfig } from '../config/schema.js';
import type { RawRow, RawTable } from '../io/raw-table.js';
import { mapHeaders, type ColumnMap } from './map-headers.js';
import { parseScore } from './parse-score.js';
import { findUnreadableChars, normalizeCell } from './text.js';
import type { ImportIssue, Score, StudentRecord, SubjectName } from './types.js';

export interface NormalizeResult {
  students: StudentRecord[];
  issues: ImportIssue[];
}

/** 檔名中第一組三位數字視為班級，例如 701.csv、七年級-712班.xlsx。 */
export function classFromFileName(file: string): string | undefined {
  return /\d{3}/.exec(file)?.[0];
}

type RowResult =
  | { ok: true; student: StudentRecord; warnings: ImportIssue[] }
  | { ok: false; issue: ImportIssue } | { ok: 'blank' };

function normalizeRow(
  row: RawRow,
  file: string,
  columns: ColumnMap,
  fileClass: string | undefined,
  config: DigestConfig,
): RowResult {
  const cell = (index: number | undefined): string =>
    index === undefined ? '' : normalizeCell(row.cells[index] ?? '');

  if (row.cells.every((value) => normalizeCell(value) === '')) {
    return { ok: 'blank' };
  }

  const className = cell(columns.className) || fileClass;
  const seat = cell(columns.seat);
  const at = {
    file,
    row: row.rowNumber,
    ...(className !== undefined && seat !== '' && { classSeat: { className, seat } }),
  };
  const studentId = cell(columns.studentId);
  if (studentId === '') {
    return { ok: false, issue: { kind: 'missing-id', ...at, message: '缺少學號' } };
  }

  const scores = new Map<SubjectName, Score>();
  const errors: string[] = [];
  for (const [subject, index] of columns.subjects) {
    if (row.uncachedFormulaColumns?.includes(index) === true) {
      errors.push(`${subject}：公式沒有計算結果（請在 Excel 中開啟後重新存檔），不可視為缺考`);
      continue;
    }
    const parsed = parseScore(row.cells[index] ?? '', config.absentTokens);
    if (parsed.kind === 'invalid') errors.push(`${subject}：${parsed.reason}`);
    else scores.set(subject, parsed);
  }
  if (errors.length > 0) {
    return { ok: false, issue: { kind: 'invalid-score', ...at, studentId, message: errors.join('；') } };
  }

  if (className === undefined) {
    return {
      ok: false,
      issue: { kind: 'missing-class', ...at, studentId, message: '沒有班級欄位，也無法從檔名判斷班級' },
    };
  }

  const name = cell(columns.name);
  const unreadable = findUnreadableChars(name);
  const warnings: ImportIssue[] =
    unreadable.length === 0
      ? []
      : [
          {
            kind: 'suspicious-name',
            ...at,
            studentId,
            message: `姓名「${name}」含無法辨識的字元（${unreadable.join('、')}），可能是罕用字或造字在存檔時遺失；已照常匯入，請導師改用「CSV UTF-8」或 .xlsx 重新匯出後再確認`,
          },
        ];
  return {
    ok: true,
    student: { studentId, className, seat, name, scores, source: { file, row: row.rowNumber } },
    warnings,
  };
}

export function normalizeTable(table: RawTable, config: DigestConfig): NormalizeResult {
  const mapped = mapHeaders(table.headers, config);
  if (!mapped.ok) {
    return {
      students: [],
      issues: [{ kind: 'file-error', file: table.file, row: 1, message: `${mapped.error}，整個檔案未匯入` }],
    };
  }

  const issues: ImportIssue[] = [];
  if (mapped.unknown.length > 0) {
    issues.push({
      kind: 'unknown-column',
      file: table.file,
      row: 1,
      message: `無法對應的欄位已忽略：${mapped.unknown.join('、')}`,
    });
  }

  const fileClass = classFromFileName(table.file);
  const students: StudentRecord[] = [];
  for (const row of table.rows) {
    const result = normalizeRow(row, table.file, mapped.columns, fileClass, config);
    if (result.ok === true) {
      students.push(result.student);
      issues.push(...result.warnings);
    }
    else if (result.ok === false) issues.push(result.issue);
  }
  return { students, issues };
}
