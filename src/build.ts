import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BuildOptions } from './cli-args.js';
import { loadConfig } from './config/load.js';
import { importFolder } from './io/import-folder.js';
import { renderFullReport } from './report/html/render-full.js';
import { renderPublicReport } from './report/html/render-public.js';
import { buildReportModel } from './report/model.js';
import { toPublicModel } from './report/redact.js';
import { writeScoreWorkbook } from './report/write-xlsx.js';

export const OUTPUT_FILES = {
  report: 'exam-report.html',
  workbook: 'exam-scores.xlsx',
  publicReport: 'exam-report-public.html',
} as const;

const TITLE = '段考成績分析報表';

export interface BuildResult {
  outputs: string[];
  classCount: number;
  studentCount: number;
  issueCount: number;
  previousIssueCount: number | null;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function runBuild(options: BuildOptions, now: Date = new Date()): Promise<BuildResult> {
  const config = await loadConfig(options.configPath);
  const current = await importFolder(options.inputDir, config);
  const previous = options.prevDir === undefined ? null : await importFolder(options.prevDir, config);
  const model = buildReportModel({ current, previous, subjects: config.subjects.map((s) => s.name) });
  const renderOptions = { title: TITLE, generatedAt: formatTimestamp(now) };

  await mkdir(options.outDir, { recursive: true });
  const outputs: string[] = [];
  if (options.isPublic) {
    const path = join(options.outDir, OUTPUT_FILES.publicReport);
    await writeFile(path, renderPublicReport(toPublicModel(model), renderOptions), 'utf8');
    outputs.push(path);
  } else {
    const reportPath = join(options.outDir, OUTPUT_FILES.report);
    await writeFile(reportPath, renderFullReport(model, renderOptions), 'utf8');
    const workbookPath = join(options.outDir, OUTPUT_FILES.workbook);
    await writeScoreWorkbook(model, workbookPath);
    outputs.push(reportPath, workbookPath);
  }

  return {
    outputs,
    classCount: model.classes.length,
    studentCount: model.studentCount,
    issueCount: model.issues.length,
    previousIssueCount: model.previousIssues?.length ?? null,
  };
}
