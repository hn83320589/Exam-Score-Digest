import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { DigestConfig } from '../config/schema.js';
import { dedupeStudents } from '../domain/dedupe.js';
import { normalizeTable } from '../domain/normalize.js';
import { classSeatKey, type ImportIssue, type StudentRecord } from '../domain/types.js';
import type { RawTable } from './raw-table.js';
import { readCsv } from './read-csv.js';
import { readXlsx } from './read-xlsx.js';

const SUPPORTED = new Set(['.csv', '.xlsx']);

export interface ImportResult {
  files: string[];
  students: StudentRecord[];
  issues: ImportIssue[];
  duplicateIds: ReadonlySet<string>;
  /** 被跳過的資料列上的學號（含重複學號列）；比較時不可誤判為轉學。 */
  erroredIds: ReadonlySet<string>;
  /** 因資料錯誤被跳過的列之班級與座號（classSeatKey）；學號空白或誤植時用來避免誤判為轉學。 */
  erroredSeats: ReadonlySet<string>;
}

export async function listScoreFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`無法讀取資料夾 ${dir}：${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('~$') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((name) => SUPPORTED.has(extname(name).toLowerCase()))
    .sort();
}

async function readTable(dir: string, file: string): Promise<RawTable> {
  const bytes = await readFile(join(dir, file));
  return extname(file).toLowerCase() === '.csv' ? readCsv(file, bytes) : readXlsx(file, bytes);
}

export async function importFolder(dir: string, config: DigestConfig): Promise<ImportResult> {
  const files = await listScoreFiles(dir);
  if (files.length === 0) {
    throw new Error(`資料夾 ${dir} 中沒有任何 .csv 或 .xlsx 成績檔`);
  }

  const students: StudentRecord[] = [];
  const issues: ImportIssue[] = [];
  for (const file of files) {
    let table: RawTable;
    try {
      table = await readTable(dir, file);
    } catch (error) {
      issues.push({
        kind: 'file-error',
        file,
        message: `無法讀取檔案：${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    const normalized = normalizeTable(table, config);
    students.push(...normalized.students);
    issues.push(...normalized.issues);
  }

  const deduped = dedupeStudents(students);
  const allIssues = [...issues, ...deduped.issues].sort(compareIssues);
  const erroredIds = new Set(allIssues.flatMap((i) => (i.studentId === undefined ? [] : [i.studentId])));
  const erroredSeats = new Set(allIssues.flatMap((i) => (i.classSeat === undefined ? [] : [classSeatKey(i.classSeat)])));
  return {
    files,
    students: deduped.students,
    issues: allIssues,
    duplicateIds: deduped.duplicateIds,
    erroredIds,
    erroredSeats,
  };
}

function compareIssues(a: ImportIssue, b: ImportIssue): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  return (a.row ?? 0) - (b.row ?? 0);
}
