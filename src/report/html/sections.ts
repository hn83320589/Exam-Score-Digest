import { BINS } from '../../stats/distribution.js';
import type { SubjectStats } from '../../stats/subject-stats.js';
import { EMPTY, formatFixed, formatPercent } from '../format.js';
import type { PublicClassSummary, PublicReportModel } from '../redact.js';
import { html, SafeHtml } from './html.js';
import { histogram, scoreBars } from './svg-charts.js';
import { STYLES } from './styles.js';

export interface PageOptions {
  title: string;
  subtitle: string;
  generatedAt: string;
  toc: { id: string; label: string }[];
  body: SafeHtml;
}

export function page(options: PageOptions): string {
  return html`<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${options.title}</title>
<style>${new SafeHtml(STYLES)}</style>
</head>
<body>
<main>
<header class="page">
  <h1>${options.title}</h1>
  <p class="meta">${options.subtitle}</p>
</header>
<nav class="toc">${options.toc.map((t) => html`<a href="#${t.id}">${t.label}</a>`)}</nav>
${options.body}
<footer>產生時間：${options.generatedAt}｜由 exam-score-digest 產生</footer>
</main>
</body>
</html>
`.value;
}

export function tableWrap(content: SafeHtml): SafeHtml {
  return html`<div class="table-wrap"><table>${content}</table></div>`;
}

function statCells(s: SubjectStats): SafeHtml {
  const d = s.stats;
  return html`<td class="num">${s.enrolled}</td><td class="num">${s.taken}</td><td class="num">${s.absent}</td>
<td class="num">${formatFixed(d?.mean)}</td><td class="num">${formatFixed(d?.median)}</td><td class="num">${formatFixed(d?.sd)}</td>
<td class="num">${d === null ? EMPTY : d.max}</td><td class="num">${d === null ? EMPTY : d.min}</td><td class="num">${formatPercent(d?.passRate)}</td>`;
}

const STAT_HEADERS = html`<th class="num">應考</th><th class="num">實考</th><th class="num">缺考</th>
<th class="num">平均</th><th class="num">中位數</th><th class="num">標準差</th><th class="num">最高分</th><th class="num">最低分</th><th class="num">及格率</th>`;

export function subjectStatsTable(caption: string, stats: readonly SubjectStats[]): SafeHtml {
  return tableWrap(html`<caption>${caption}</caption>
<thead><tr><th>科目</th>${STAT_HEADERS}</tr></thead>
<tbody>${stats.map((s) => html`<tr><th scope="row">${s.subject}</th>${statCells(s)}</tr>`)}</tbody>`);
}

/** 班級平均 = 該班各科平均的平均（各科權重相同）。 */
export function classAverage(subjects: readonly SubjectStats[]): number | null {
  const means = subjects.flatMap((s) => (s.stats === null ? [] : [s.stats.mean]));
  return means.length === 0 ? null : means.reduce((a, b) => a + b, 0) / means.length;
}

const HEAT_LEVELS = 7;

function heatLevel(value: number, min: number, max: number): number {
  if (max === min) return Math.floor(HEAT_LEVELS / 2);
  return Math.min(HEAT_LEVELS - 1, Math.floor(((value - min) / (max - min)) * HEAT_LEVELS));
}

function classHeatmap(model: PublicReportModel): SafeHtml {
  const means = model.classes.flatMap((k) => k.subjects.flatMap((s) => (s.stats === null ? [] : [s.stats.mean])));
  const min = Math.min(...means);
  const max = Math.max(...means);
  const cell = (s: SubjectStats | undefined): SafeHtml =>
    s === undefined || s.stats === null
      ? html`<td class="num">${EMPTY}</td>`
      : html`<td class="heat heat-${heatLevel(s.stats.mean, min, max)}" title="${s.subject} 平均 ${formatFixed(s.stats.mean)}（實考 ${s.taken} 人）">${formatFixed(s.stats.mean)}</td>`;

  return html`<div class="table-wrap"><table>
<caption>各班各科平均</caption>
<thead><tr><th>班級</th><th class="num">人數</th>${model.subjects.map((s) => html`<th class="num">${s}</th>`)}<th class="num">班級平均</th></tr></thead>
<tbody>${model.classes.map(
    (k) => html`<tr><th scope="row">${k.className}</th><td class="num">${k.studentCount}</td>${model.subjects.map((subject) =>
      cell(k.subjects.find((s) => s.subject === subject)),
    )}<td class="num">${formatFixed(classAverage(k.subjects))}</td></tr>`,
  )}</tbody>
<tfoot><tr><th scope="row">全年級</th><td class="num">${model.studentCount}</td>${model.grade.map(
    (s) => html`<td class="num">${formatFixed(s.stats?.mean)}</td>`,
  )}<td class="num">${formatFixed(classAverage(model.grade))}</td></tr></tfoot>
</table>
<div class="heat-legend">低 ${formatFixed(min)} ${Array.from({ length: HEAT_LEVELS }, (_, i) => html`<span class="sw heat-${i}"></span>`)} 高 ${formatFixed(max)}</div>
</div>`;
}

export function overviewSection(model: PublicReportModel): SafeHtml {
  const gradeAverage = classAverage(model.grade);
  return html`<section id="overview">
<h2>年級總覽</h2>
<div class="tiles">
  <div class="tile"><div class="k">班級數</div><div class="v">${model.classes.length}</div></div>
  <div class="tile"><div class="k">學生數</div><div class="v">${model.studentCount}</div></div>
  <div class="tile"><div class="k">年級平均</div><div class="v">${formatFixed(gradeAverage)}</div></div>
  <div class="tile"><div class="k">參與排名</div><div class="v">${model.rankedCount}</div></div>
  <div class="tile"><div class="k">有缺考科目</div><div class="v">${model.excludedCount}</div></div>
</div>
${subjectStatsTable('全年級各科統計', model.grade)}
<p class="note">應考 = 匯入的學生數（含缺考）；實考 = 應考 − 缺考，為平均、中位數、標準差（母體）與及格率的分母。及格為 60 分以上（含 60）。</p>
</section>`;
}

function classDetails(k: PublicClassSummary): SafeHtml {
  return html`<details><summary>${k.className} 班（${k.studentCount} 人）各科統計</summary>
${subjectStatsTable(`${k.className} 班各科統計`, k.subjects)}</details>`;
}

export function classComparisonSection(model: PublicReportModel): SafeHtml {
  const items = model.classes.flatMap((k) => {
    const avg = classAverage(k.subjects);
    return avg === null ? [] : [{ label: k.className, value: avg }];
  });
  const gradeAverage = classAverage(model.grade);
  return html`<section id="classes">
<h2>各班比較</h2>
<div class="panel">
  <h3>各班平均分數</h3>
  ${scoreBars('各班平均分數', items, gradeAverage === null ? undefined : { label: '全年級', value: gradeAverage })}
  <p class="note">班級平均為該班 8 科平均的平均（各科權重相同）；虛線為全年級平均。</p>
</div>
${classHeatmap(model)}
${model.classes.map(classDetails)}
</section>`;
}

export function distributionSection(model: PublicReportModel): SafeHtml {
  return html`<section id="distribution">
<h2>各科分數分布</h2>
<p class="note">每 10 分一個級距：0 ≤ 分數 &lt; 10 為「0–9」……80 ≤ 分數 &lt; 90 為「80–89」（89.9 分屬於此級）；最後一級「90–100」包含 100 分。缺考不計入。</p>
<div class="grid-2">
${model.distribution.map(
  (d) => html`<div class="panel"><h3>${d.subject}</h3>
${histogram(d.subject, BINS.map((bin, i) => ({ ...bin, count: d.counts[i] ?? 0 })))}</div>`,
)}
</div>
${tableWrap(html`<caption>各科分數分布（人數）</caption>
<thead><tr><th>科目</th>${BINS.map((b) => html`<th class="num" title="${b.range}">${b.label}</th>`)}<th class="num">實考</th></tr>
<tr><th></th>${BINS.map((b) => html`<th class="num note">${b.range.replace(' 分數 ', ' x ')}</th>`)}<th></th></tr></thead>
<tbody>${model.distribution.map(
  (d) => html`<tr><th scope="row">${d.subject}</th>${d.counts.map((c) => html`<td class="num">${c}</td>`)}<td class="num">${d.counts.reduce((a, b) => a + b, 0)}</td></tr>`,
)}</tbody>`)}
</section>`;
}
