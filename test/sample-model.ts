import { join } from 'node:path';
import { loadConfig } from '../src/config/load.js';
import { importFolder, type ImportResult } from '../src/io/import-folder.js';
import { buildReportModel, type ReportModel } from '../src/report/model.js';

export const SAMPLE_DIR = join(import.meta.dirname, '..', 'sample-data');

export interface SampleData {
  current: ImportResult;
  previous: ImportResult;
  model: ReportModel;
}

export async function loadSampleModel(): Promise<SampleData> {
  const config = await loadConfig();
  const current = await importFolder(join(SAMPLE_DIR, 'current'), config);
  const previous = await importFolder(join(SAMPLE_DIR, 'previous'), config);
  const model = buildReportModel({ current, previous, subjects: config.subjects.map((s) => s.name) });
  return { current, previous, model };
}

/** 報表必須能離線開啟：不得引用任何外部資源。 */
export const EXTERNAL_REFERENCE_PATTERNS = [/https?:\/\//i, /<script\b[^>]*\bsrc=/i, /<link\b/i, /@import/i, /url\(/i];
