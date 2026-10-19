import { html, type SafeHtml } from './html.js';

// 內嵌於 HTML5 的 SVG 不需要 xmlns 屬性；省略它，輸出中就不會出現任何 http:// 字串。

const BAR_RADIUS = 4;

/** 只有資料端（遠離基準線的一端）是圓角，基準線端保持方角。 */
function columnPath(x: number, top: number, width: number, baseline: number): string {
  const r = Math.min(BAR_RADIUS, baseline - top, width / 2);
  return `M${x},${baseline}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${baseline}Z`;
}

function rowPath(baseline: number, y: number, end: number, height: number): string {
  const r = Math.min(BAR_RADIUS, end - baseline, height / 2);
  return `M${baseline},${y}H${end - r}Q${end},${y} ${end},${y + r}V${y + height - r}Q${end},${y + height} ${end - r},${y + height}H${baseline}Z`;
}

/** 取 1、2、5 × 10^n 的整齊刻度上限。 */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * magnitude >= value) ?? 10;
  return step * magnitude;
}

export interface HistogramBin {
  label: string;
  range: string;
  count: number;
}

export function histogram(title: string, bins: readonly HistogramBin[]): SafeHtml {
  const width = 440;
  const height = 200;
  const margin = { top: 12, right: 8, bottom: 30, left: 34 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const baseline = margin.top + plotH;
  const max = niceMax(Math.max(...bins.map((b) => b.count)));
  const band = plotW / bins.length;
  const barW = Math.min(24, band - 8);
  const ticks = [0, max / 2, max];
  const y = (v: number): number => baseline - (v / max) * plotH;

  return html`<svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title} 分數分布">
  ${ticks.map(
    (t) => html`<line class="grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(t)}" y2="${y(t)}"/>
  <text class="tick" x="${margin.left - 6}" y="${y(t) + 4}" text-anchor="end">${Number.isInteger(t) ? t : t.toFixed(1)}</text>`,
  )}
  ${bins.map((bin, i) => {
    const x = margin.left + i * band;
    const top = y(bin.count);
    return html`<g class="mark">
    <title>${bin.label} 分（${bin.range}）：${bin.count} 人</title>
    <rect class="hit" x="${x}" y="${margin.top}" width="${band}" height="${plotH}"/>
    ${bin.count > 0 ? html`<path class="bar" d="${columnPath(x + (band - barW) / 2, top, barW, baseline)}"/>` : ''}
    <text class="tick" x="${x + band / 2}" y="${baseline + 16}" text-anchor="middle">${bin.label}</text>
  </g>`;
  })}
  <line class="axis" x1="${margin.left}" x2="${width - margin.right}" y1="${baseline}" y2="${baseline}"/>
</svg>`;
}

export interface BarItem {
  label: string;
  value: number;
}

/** 水平長條圖，數值軸固定 0–100（分數）。reference 為參考線（例如全年級平均）。 */
export function scoreBars(title: string, items: readonly BarItem[], reference?: { label: string; value: number }): SafeHtml {
  const rowH = 26;
  const barH = 16;
  const margin = { top: reference === undefined ? 8 : 24, right: 56, bottom: 26, left: 44 };
  const width = 960;
  const plotW = width - margin.left - margin.right;
  const height = margin.top + items.length * rowH + margin.bottom;
  const baseline = margin.left;
  const x = (v: number): number => baseline + (v / 100) * plotW;
  const bottom = margin.top + items.length * rowH;

  return html`<svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
  ${[0, 20, 40, 60, 80, 100].map(
    (t) => html`<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${margin.top}" y2="${bottom}"/>
  <text class="tick" x="${x(t)}" y="${bottom + 16}" text-anchor="middle">${t}</text>`,
  )}
  ${
    reference === undefined
      ? ''
      : html`<line class="reference" x1="${x(reference.value)}" x2="${x(reference.value)}" y1="${margin.top - 6}" y2="${bottom}"/>
  <text class="tick" x="${x(reference.value)}" y="${margin.top - 10}" text-anchor="middle">${reference.label} ${reference.value.toFixed(2)}</text>`
  }
  ${items.map((item, i) => {
    const top = margin.top + i * rowH;
    return html`<g class="mark">
    <title>${item.label}：${item.value.toFixed(2)} 分</title>
    <rect class="hit" x="0" y="${top}" width="${width}" height="${rowH}"/>
    <text class="label" x="${baseline - 8}" y="${top + rowH / 2 + 4}" text-anchor="end">${item.label}</text>
    <path class="bar" d="${rowPath(baseline, top + (rowH - barH) / 2, x(item.value), barH)}"/>
    <text class="value" x="${x(item.value) + 6}" y="${top + rowH / 2 + 4}">${item.value.toFixed(2)}</text>
  </g>`;
  })}
  <line class="axis" x1="${baseline}" x2="${baseline}" y1="${margin.top}" y2="${bottom}"/>
</svg>`;
}
