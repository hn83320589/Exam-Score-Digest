import { beforeAll, describe, expect, it } from 'vitest';
import { renderFullReport } from '../src/report/html/render-full.js';
import { renderPublicReport } from '../src/report/html/render-public.js';
import { toPublicModel } from '../src/report/redact.js';
import { escapeHtml } from '../src/report/html/html.js';
import { EXTERNAL_REFERENCE_PATTERNS, loadSampleModel, type SampleData } from './sample-model.js';

const OPTIONS = { title: '七年級第二次段考成績報表', generatedAt: '2026-10-19 20:00' };

let sample: SampleData;
let full: string;
let publicHtml: string;

beforeAll(async () => {
  sample = await loadSampleModel();
  full = renderFullReport(sample.model, OPTIONS);
  publicHtml = renderPublicReport(toPublicModel(sample.model), OPTIONS);
});

describe('完整版 HTML 報表', () => {
  it('包含年級總覽、各班比較、分布圖、排名、比較結果與匯入問題清單', () => {
    for (const id of ['overview', 'classes', 'distribution', 'ranking', 'comparison', 'issues']) {
      expect(full).toContain(`<section id="${id}">`);
    }
    expect(full.match(/<svg /g)?.length).toBe(9);
  });

  it('不引用任何外部資源（http(s)://、外部 script、link、@import、url()）', () => {
    for (const pattern of EXTERNAL_REFERENCE_PATTERNS) {
      expect(full).not.toMatch(pattern);
    }
  });

  it('所有學生姓名完整顯示', () => {
    for (const student of sample.current.students) {
      expect(full).toContain(escapeHtml(student.name));
    }
  });

  it('有缺考科目的學生另外列出', () => {
    const excludedSection = full.slice(full.indexOf('id="excluded"'), full.indexOf('id="comparison"'));

    for (const s of sample.model.ranking.excluded) {
      expect(excludedSection).toContain(s.student.studentId);
    }
    expect(sample.model.ranking.excluded).toHaveLength(4);
  });

  it('匯入問題清單附檔名與列號，重複學號列出兩個來源', () => {
    const issues = full.slice(full.indexOf('<section id="issues">'));

    expect(issues).toContain('<td>701.csv</td><td class="num">9</td>');
    expect(issues).toContain('707.csv 第 16 列');
    expect(issues).toContain('711.xlsx');
  });

  it('標示轉入、轉出，因資料錯誤無法比較的學生不誤判為轉學', () => {
    const comparison = sample.model.comparison;

    expect(comparison?.transferredIn.map((s) => s.student.studentId)).toEqual(['1129001', '1129002']);
    expect(comparison?.transferredOut.map((s) => s.student.studentId)).toEqual(['1120330', '1120930']);
    expect(comparison?.unmatched.map((u) => u.summary.student.studentId).sort()).toEqual(
      ['1120108', '1120604', '1120810', '1120912', '1121002', '1121115'].sort(),
    );
    expect(full).toContain('轉入');
    expect(full).toContain('轉出');
  });
});

describe('公開版 HTML 報表', () => {
  it('搜尋不到任何學生姓名', () => {
    const names = [...sample.current.students, ...sample.previous.students].map((s) => s.name);

    for (const name of names) {
      expect(publicHtml).not.toContain(name);
    }
  });

  it('搜尋不到任何完整學號（含因錯誤被跳過的學號）', () => {
    const ids = new Set([
      ...sample.current.students.map((s) => s.studentId),
      ...sample.current.erroredIds,
      ...sample.previous.students.map((s) => s.studentId),
    ]);

    for (const id of ids) {
      expect(publicHtml).not.toContain(id);
    }
  });

  it('只保留統計與分布，沒有排名、比較與問題清單', () => {
    expect(publicHtml).toContain('<section id="overview">');
    expect(publicHtml).toContain('<section id="distribution">');
    for (const id of ['ranking', 'comparison', 'issues']) {
      expect(publicHtml).not.toContain(`id="${id}"`);
    }
  });

  it('同樣不引用任何外部資源', () => {
    for (const pattern of EXTERNAL_REFERENCE_PATTERNS) {
      expect(publicHtml).not.toMatch(pattern);
    }
  });
});
