import type { ImportIssue, ImportIssueKind } from '../../domain/types.js';
import type { ComparisonEntry, ComparisonResult } from '../../stats/compare.js';
import type { StudentSummary } from '../../stats/student-summary.js';
import { EMPTY, formatFixed, formatScore, formatSigned, formatTenths } from '../format.js';
import type { ReportModel } from '../model.js';
import { toPublicModel } from '../redact.js';
import { html, type SafeHtml } from './html.js';
import { classComparisonSection, distributionSection, overviewSection, page, tableWrap } from './sections.js';

export interface RenderOptions {
  title: string;
  generatedAt: string;
}

const ISSUE_LABELS: Record<ImportIssueKind, string> = {
  'file-error': '檔案無法匯入',
  'unknown-column': '未知欄位（已忽略）',
  'missing-id': '缺少學號',
  'missing-class': '缺少班級',
  'invalid-score': '分數錯誤',
  'duplicate-id': '學號重複',
  'suspicious-name': '姓名含無法辨識的字元',
};

/** 這些問題的資料仍照常匯入，以警示色標示；其餘為資料列被跳過。 */
const WARNING_KINDS: ReadonlySet<ImportIssueKind> = new Set(['unknown-column', 'suspicious-name']);

function identityCells(s: StudentSummary): SafeHtml {
  const { student } = s;
  return html`<td>${student.className}</td><td class="num">${student.seat}</td><td>${student.studentId}</td><td>${student.name}</td>`;
}

const IDENTITY_HEADERS = html`<th>班級</th><th class="num">座號</th><th>學號</th><th>姓名</th>`;

function scoreCells(s: StudentSummary, subjects: readonly string[]): SafeHtml[] {
  return subjects.map((subject) => {
    const score = s.student.scores.get(subject);
    return score?.kind === 'present'
      ? html`<td class="num">${formatScore(score)}</td>`
      : html`<td class="num absent">${formatScore(score)}</td>`;
  });
}

function rankingSection(model: ReportModel): SafeHtml {
  const { duplicateIds } = model;
  const subjectHeaders = model.subjects.map((s) => html`<th class="num">${s}</th>`);
  const { ranked, excluded } = model.ranking;
  const dupBadge = (s: StudentSummary): SafeHtml | string =>
    duplicateIds.has(s.student.studentId) ? html`<span class="badge bad">學號重複</span>` : '';

  return html`<section id="ranking">
<h2>全年級排名</h2>
<p class="note">依平均分數排名，同分同名次、下一名次跳號（例如 1、2、2、4）。PR = 100 × (分數低於該生的人數 + 0.5 × 同分人數) / 總人數，四捨五入取整數，上限 99、下限 1；總人數為參與排名的 ${ranked.length} 人。有任何科目缺考的學生不參與排名與 PR，另列於下方。</p>
${tableWrap(html`<caption>排名（${ranked.length} 人）</caption>
<thead><tr><th class="num">名次</th><th class="num">PR</th>${IDENTITY_HEADERS}${subjectHeaders}<th class="num">總分</th><th class="num">平均</th></tr></thead>
<tbody>${ranked.map(
  (r) => html`<tr><td class="num">${r.rank}</td><td class="num">${r.pr}</td>${identityCells(r)}${scoreCells(r, model.subjects)}<td class="num">${formatTenths(r.totalTenths)}</td><td class="num">${formatFixed(r.average)}${dupBadge(r)}</td></tr>`,
)}</tbody>`)}
<h3 id="excluded">有缺考科目的學生（不參與排名，${excluded.length} 人）</h3>
${
  excluded.length === 0
    ? html`<p class="empty">沒有學生缺考。</p>`
    : tableWrap(html`<thead><tr>${IDENTITY_HEADERS}${subjectHeaders}<th class="num">缺考科目數</th><th class="num">總分</th><th class="num">平均（實考科目）</th></tr></thead>
<tbody>${excluded.map(
        (s) => html`<tr>${identityCells(s)}${scoreCells(s, model.subjects)}<td class="num">${s.absentCount}</td><td class="num">${formatTenths(s.totalTenths)}</td><td class="num">${formatFixed(s.average)}${dupBadge(s)}</td></tr>`,
      )}</tbody>`)
}
</section>`;
}

function moversTable(caption: string, entries: readonly ComparisonEntry[]): SafeHtml {
  if (entries.length === 0) return html`<h3>${caption}</h3><p class="empty">無。</p>`;
  return tableWrap(html`<caption>${caption}</caption>
<thead><tr><th class="num">#</th>${IDENTITY_HEADERS}<th class="num">上次平均</th><th class="num">本次平均</th><th class="num">差值</th><th class="num">缺考 上次／本次</th></tr></thead>
<tbody>${entries.map(
    (e, i) => html`<tr><td class="num">${i + 1}</td>${identityCells(e.current)}<td class="num">${formatFixed(e.previous.average)}</td><td class="num">${formatFixed(e.current.average)}</td><td class="num">${formatSigned(e.delta)}</td><td class="num">${e.previous.absentCount}／${e.current.absentCount}</td></tr>`,
  )}</tbody>`);
}

function transferTable(caption: string, label: string, students: readonly StudentSummary[]): SafeHtml {
  if (students.length === 0) return html`<h3>${caption}</h3><p class="empty">無。</p>`;
  return tableWrap(html`<caption>${caption}</caption>
<thead><tr>${IDENTITY_HEADERS}<th>標示</th></tr></thead>
<tbody>${students.map((s) => html`<tr>${identityCells(s)}<td><span class="badge warn">${label}</span></td></tr>`)}</tbody>`);
}

function comparisonSection(comparison: ComparisonResult | null): SafeHtml {
  if (comparison === null) {
    return html`<section id="comparison"><h2>與上次段考比較</h2>
<p class="empty">未指定上次段考資料（使用 --prev 參數）。</p></section>`;
  }
  return html`<section id="comparison">
<h2>與上次段考比較</h2>
<p class="note">以學號比對兩次段考，比較個人平均分數（只計入有應考的科目）。共比較 ${comparison.comparedCount} 人；只在其中一次出現的學生標示為轉入或轉出，不列入比較。</p>
<div class="grid-2">
<div>${moversTable('進步前 10 名', comparison.improved)}</div>
<div>${moversTable('退步前 10 名', comparison.declined)}</div>
</div>
<div class="grid-2">
<div>${transferTable(`轉入（${comparison.transferredIn.length} 人，僅本次出現）`, '轉入', comparison.transferredIn)}</div>
<div>${transferTable(`轉出（${comparison.transferredOut.length} 人，僅上次出現）`, '轉出', comparison.transferredOut)}</div>
</div>
${
  comparison.unmatched.length === 0
    ? ''
    : tableWrap(html`<caption>無法比較（${comparison.unmatched.length} 人）</caption>
<thead><tr>${IDENTITY_HEADERS}<th>原因</th></tr></thead>
<tbody>${comparison.unmatched.map((u) => html`<tr>${identityCells(u.summary)}<td>${u.reason}</td></tr>`)}</tbody>`)
}
</section>`;
}

function issuesTable(caption: string, issues: readonly ImportIssue[]): SafeHtml {
  if (issues.length === 0) return html`<h3>${caption}</h3><p class="empty">沒有任何問題。</p>`;
  return tableWrap(html`<caption>${caption}（${issues.length} 筆）</caption>
<thead><tr><th>檔案</th><th class="num">列號</th><th>類型</th><th>學號</th><th>說明</th><th>另一來源</th></tr></thead>
<tbody>${issues.map(
    (i) => html`<tr><td>${i.file}</td><td class="num">${i.row ?? EMPTY}</td><td><span class="badge ${WARNING_KINDS.has(i.kind) ? 'warn' : 'bad'}">${ISSUE_LABELS[i.kind]}</span></td><td>${i.studentId ?? EMPTY}</td><td>${i.message}</td><td>${
      i.related?.map((r) => `${r.file} 第 ${r.row} 列`).join('、') ?? EMPTY
    }</td></tr>`,
  )}</tbody>`);
}

function issuesSection(model: ReportModel): SafeHtml {
  return html`<section id="issues">
<h2>匯入問題清單</h2>
<p class="note">列號與 Excel 中看到的列號相同（標題列為第 1 列）。分數錯誤、缺少學號、學號重複的資料列已跳過；未知欄位與姓名含無法辨識字元（黃色標示）的資料仍照常匯入。</p>
${issuesTable('本次段考', model.issues)}
${model.previousIssues === null ? '' : issuesTable('上次段考', model.previousIssues)}
</section>`;
}

export function renderFullReport(model: ReportModel, options: RenderOptions): string {
  const publicModel = toPublicModel(model);
  return page({
    title: options.title,
    subtitle: `完整版（含個人資料，請勿公開張貼）｜${model.classes.length} 班、${model.studentCount} 人、${model.files.length} 個檔案｜匯入問題 ${model.issues.length} 筆`,
    generatedAt: options.generatedAt,
    toc: [
      { id: 'overview', label: '年級總覽' },
      { id: 'classes', label: '各班比較' },
      { id: 'distribution', label: '各科分布' },
      { id: 'ranking', label: '排名' },
      { id: 'comparison', label: '與上次比較' },
      { id: 'issues', label: '匯入問題' },
    ],
    body: html`${overviewSection(publicModel)}
${classComparisonSection(publicModel)}
${distributionSection(publicModel)}
${rankingSection(model)}
${comparisonSection(model.comparison)}
${issuesSection(model)}`,
  });
}
