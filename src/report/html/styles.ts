// 報表必須能離線開啟：只用系統字型，不載入任何外部資源。
export const STYLES = `
:root {
  color-scheme: light;
  --surface-0: #f6f5f2;
  --surface-1: #fcfcfb;
  --border: #dedcd5;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #77756f;
  --grid: #e7e5df;
  --axis: #a3a199;
  --series-1: #2a78d6;
  --reference: #52514e;
  --warn-bg: #fdf3dc;
  --warn-text: #7a4b00;
  --bad-bg: #fbe4e3;
  --bad-text: #8f1f1e;
  --heat-0: #cde2fb; --heat-1: #b7d3f6; --heat-2: #9ec5f4; --heat-3: #6da7ec;
  --heat-4: #3987e5; --heat-5: #256abf; --heat-6: #184f95;
  --heat-ink-low: #0b0b0b; --heat-ink-high: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface-0: #121211; --surface-1: #1a1a19; --border: #383835;
    --text-primary: #f0efec; --text-secondary: #c3c2b7; --text-muted: #9a998f;
    --grid: #2c2c2a; --axis: #6b6a63; --series-1: #3987e5; --reference: #c3c2b7;
    --warn-bg: #3a2e12; --warn-text: #f5cf7a; --bad-bg: #3d1c1c; --bad-text: #f2a3a2;
    --heat-0: #104281; --heat-1: #184f95; --heat-2: #1c5cab; --heat-3: #256abf;
    --heat-4: #2a78d6; --heat-5: #5598e7; --heat-6: #86b6ef;
    --heat-ink-low: #f0efec; --heat-ink-high: #0b0b0b;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --surface-0: #121211; --surface-1: #1a1a19; --border: #383835;
  --text-primary: #f0efec; --text-secondary: #c3c2b7; --text-muted: #9a998f;
  --grid: #2c2c2a; --axis: #6b6a63; --series-1: #3987e5; --reference: #c3c2b7;
  --warn-bg: #3a2e12; --warn-text: #f5cf7a; --bad-bg: #3d1c1c; --bad-text: #f2a3a2;
  --heat-0: #104281; --heat-1: #184f95; --heat-2: #1c5cab; --heat-3: #256abf;
  --heat-4: #2a78d6; --heat-5: #5598e7; --heat-6: #86b6ef;
  --heat-ink-low: #f0efec; --heat-ink-high: #0b0b0b;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--surface-0);
  color: var(--text-primary);
  font: 15px/1.6 "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", system-ui, sans-serif;
}
main { max-width: 1200px; margin: 0 auto; padding: 24px 16px 64px; }
header.page { margin-bottom: 8px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 20px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--border); }
h3 { font-size: 16px; margin: 20px 0 8px; }
.meta { color: var(--text-secondary); margin: 0; }
.note { color: var(--text-secondary); font-size: 13px; margin: 6px 0 12px; }
nav.toc { position: sticky; top: 0; z-index: 1; background: var(--surface-0); padding: 8px 0;
  border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 4px 16px; }
nav.toc a { color: var(--text-secondary); text-decoration: none; font-size: 14px; }
nav.toc a:hover { color: var(--text-primary); text-decoration: underline; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
.tile { background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
.tile .k { color: var(--text-secondary); font-size: 13px; }
.tile .v { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
.panel { background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin: 12px 0; }
.panel h3 { margin-top: 0; }
.table-wrap { overflow-x: auto; background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; margin: 12px 0; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
caption { text-align: left; padding: 10px 12px 4px; font-weight: 600; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { text-align: left; color: var(--text-secondary); font-weight: 600; font-size: 13px; background: var(--surface-1); }
td.num, th.num { text-align: right; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: color-mix(in srgb, var(--series-1) 6%, transparent); }
.absent { color: var(--warn-text); background: var(--warn-bg); }
.badge { display: inline-block; font-size: 12px; padding: 0 6px; border-radius: 4px; margin-left: 4px; }
.badge.warn { background: var(--warn-bg); color: var(--warn-text); }
.badge.bad { background: var(--bad-bg); color: var(--bad-text); }
.up { color: var(--text-primary); }
.down { color: var(--text-primary); }
.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
.chart { max-width: 100%; height: auto; display: block; font-size: 11px; }
.chart .grid { stroke: var(--grid); stroke-width: 1; }
.chart .axis { stroke: var(--axis); stroke-width: 1; }
.chart .bar { fill: var(--series-1); }
.chart .hit { fill: transparent; }
.chart .mark:hover .bar { opacity: .8; }
.chart .tick { fill: var(--text-muted); }
.chart .label { fill: var(--text-secondary); font-size: 12px; }
.chart .value { fill: var(--text-primary); font-size: 12px; paint-order: stroke; stroke: var(--surface-1); stroke-width: 4px; stroke-linejoin: round; }
.chart .reference { stroke: var(--reference); stroke-width: 1.5; stroke-dasharray: 4 3; }
td.heat { text-align: right; }
${[0, 1, 2, 3, 4, 5, 6]
  .map((i) => `.heat-${i} { background: var(--heat-${i}); color: var(--heat-ink-${i < 4 ? 'low' : 'high'}); }`)
  .join('\n')}
.heat-legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); margin: 4px 12px 10px; }
.heat-legend span.sw { width: 22px; height: 12px; border-radius: 2px; display: inline-block; }
details { background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; margin: 8px 0; }
details > summary { cursor: pointer; padding: 8px 12px; font-weight: 600; }
details .table-wrap { border: none; border-top: 1px solid var(--border); border-radius: 0; margin: 0; }
.empty { color: var(--text-muted); padding: 12px; }
footer { margin-top: 48px; color: var(--text-muted); font-size: 12px; }
@media print {
  nav.toc { display: none; }
  details > :not(summary) { display: block; }
  .table-wrap { overflow: visible; }
}
`;
