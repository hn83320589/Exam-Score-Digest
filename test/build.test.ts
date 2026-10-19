import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { runBuild } from '../src/build.js';
import { loadConfig } from '../src/config/load.js';
import { importFolder } from '../src/io/import-folder.js';
import { EXTERNAL_REFERENCE_PATTERNS, SAMPLE_DIR } from './sample-model.js';

const CURRENT = join(SAMPLE_DIR, 'current');
const PREVIOUS = join(SAMPLE_DIR, 'previous');
const NOW = new Date(2026, 9, 19, 20, 5);

async function tempOut(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'exam-digest-out-'));
}

/** 範例資料中出現過的所有姓名與學號（含因資料錯誤被跳過的列）。 */
async function allIdentities(): Promise<{ names: string[]; ids: string[] }> {
  const config = await loadConfig();
  const current = await importFolder(CURRENT, config);
  const previous = await importFolder(PREVIOUS, config);
  const students = [...current.students, ...previous.students];
  return {
    names: [...new Set(students.map((s) => s.name))],
    ids: [...new Set([...students.map((s) => s.studentId), ...current.erroredIds, ...previous.erroredIds])],
  };
}

describe('runBuild', () => {
  it('完整版輸出 HTML 報表與 xlsx 總表（工作表數 = 班級數 + 1）', async () => {
    const outDir = await tempOut();

    const result = await runBuild({ inputDir: CURRENT, prevDir: PREVIOUS, outDir, isPublic: false }, NOW);

    expect((await readdir(outDir)).sort()).toEqual(['exam-report.html', 'exam-scores.xlsx']);
    expect(result).toMatchObject({ classCount: 12, studentCount: 355, issueCount: 6 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(join(outDir, 'exam-scores.xlsx'));
    expect(workbook.worksheets).toHaveLength(13);
    const report = await readFile(join(outDir, 'exam-report.html'), 'utf8');
    expect(report).toContain('2026-10-19 20:05');
  });

  it('輸出資料夾不存在時自動建立', async () => {
    const outDir = join(await tempOut(), 'nested', 'out');

    await runBuild({ inputDir: CURRENT, outDir, isPublic: false }, NOW);

    expect(await readdir(outDir)).toContain('exam-report.html');
  });

  it('輸入資料夾不存在時拋出含路徑的錯誤', async () => {
    await expect(runBuild({ inputDir: '/no/such/dir', outDir: await tempOut(), isPublic: false })).rejects.toThrow(
      '/no/such/dir',
    );
  });
});

describe('runBuild --public：公開版輸出檔不含任何個人資料', () => {
  it('只輸出公開版 HTML，不輸出含個資的 xlsx 總表', async () => {
    const outDir = await tempOut();

    await runBuild({ inputDir: CURRENT, prevDir: PREVIOUS, outDir, isPublic: true }, NOW);

    expect(await readdir(outDir)).toEqual(['exam-report-public.html']);
  });

  it('輸出檔中搜尋不到任何學生姓名與完整學號', async () => {
    const outDir = await tempOut();
    await runBuild({ inputDir: CURRENT, prevDir: PREVIOUS, outDir, isPublic: true }, NOW);
    const output = await readFile(join(outDir, 'exam-report-public.html'), 'utf8');
    const { names, ids } = await allIdentities();

    expect(names.length).toBeGreaterThan(300);
    expect(names.filter((name) => output.includes(name))).toEqual([]);
    expect(ids.filter((id) => output.includes(id))).toEqual([]);
  });

  it('不引用任何外部資源', async () => {
    const outDir = await tempOut();
    await runBuild({ inputDir: CURRENT, outDir, isPublic: true }, NOW);
    const output = await readFile(join(outDir, 'exam-report-public.html'), 'utf8');

    for (const pattern of EXTERNAL_REFERENCE_PATTERNS) {
      expect(output).not.toMatch(pattern);
    }
  });
});
