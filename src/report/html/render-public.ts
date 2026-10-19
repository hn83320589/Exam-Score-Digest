import type { PublicReportModel } from '../redact.js';
import { html } from './html.js';
import type { RenderOptions } from './render-full.js';
import { classComparisonSection, distributionSection, overviewSection, page } from './sections.js';

/** 只接受 PublicReportModel：型別上沒有姓名、學號與個人分數可以輸出。 */
export function renderPublicReport(model: PublicReportModel, options: RenderOptions): string {
  return page({
    title: options.title,
    subtitle: `公開版（僅含統計與分布，不含任何學生個人資料）｜${model.classes.length} 班、${model.studentCount} 人`,
    generatedAt: options.generatedAt,
    toc: [
      { id: 'overview', label: '年級總覽' },
      { id: 'classes', label: '各班比較' },
      { id: 'distribution', label: '各科分布' },
    ],
    body: html`${overviewSection(model)}
${classComparisonSection(model)}
${distributionSection(model)}`,
  });
}
