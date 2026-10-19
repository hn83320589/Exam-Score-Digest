import { describe, expect, it } from 'vitest';
import { escapeHtml, html, SafeHtml } from '../src/report/html/html.js';
import { histogram, niceMax, scoreBars } from '../src/report/html/svg-charts.js';
import { maskStudentId } from '../src/report/redact.js';
import { BINS } from '../src/stats/distribution.js';

describe('html tagged template', () => {
  it('插值預設跳脫，避免姓名等資料破壞 HTML', () => {
    const name = '<img src=x onerror="alert(1)">&';

    expect(html`<td>${name}</td>`.value).toBe('<td>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;</td>');
  });

  it('巢狀 html 與陣列原樣輸出，null／undefined／false 輸出空字串', () => {
    const items = ['a', 'b'].map((x) => html`<li>${x}</li>`);

    expect(html`<ul>${items}${null}${undefined}${false}</ul>`.value).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('不支援的值型別直接拋錯，而不是輸出 [object Object]', () => {
    expect(() => html`${{ a: 1 }}`).toThrow(TypeError);
  });

  it('escapeHtml 處理五個特殊字元', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(new SafeHtml('<b>').toString()).toBe('<b>');
  });
});

describe('SVG 圖表', () => {
  const bins = BINS.map((b, i) => ({ ...b, count: i }));

  it('直方圖為內嵌 SVG，不含 xmlns 網址，每個級距都有 tooltip 標示邊界', () => {
    const svg = histogram('國文', bins).value;

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/https?:\/\//);
    expect(svg).toContain('<title>90–100 分（90 ≤ 分數 ≤ 100）：9 人</title>');
    expect(svg).toContain('<title>80–89 分（80 ≤ 分數 &lt; 90）：8 人</title>');
  });

  it('人數為 0 的級距不畫長條，但保留 tooltip', () => {
    const svg = histogram('國文', bins).value;

    expect(svg.match(/class="bar"/g)).toHaveLength(9);
    expect(svg).toContain('0–9 分（0 ≤ 分數 &lt; 10）：0 人');
  });

  it('長條圖標示數值與參考線', () => {
    const svg = scoreBars('各班平均', [{ label: '701', value: 72.346 }], { label: '全年級', value: 70 }).value;

    expect(svg).toContain('>72.35<');
    expect(svg).toContain('class="reference"');
  });

  it.each([
    [0, 1],
    [7, 10],
    [12, 20],
    [31, 50],
    [50, 50],
  ])('niceMax(%i) = %i', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe('maskStudentId', () => {
  it('只顯示末三碼', () => {
    expect(maskStudentId('1120715')).toBe('****715');
    expect(maskStudentId('12')).toBe('**');
  });
});
