/**
 * 驗收檢查：以「黑箱」方式執行已編譯的 CLI，再從輸出檔獨立重算並比對結果。
 * 刻意不 import src/ 的任何程式，避免用同一套邏輯驗證自己。
 *
 * 執行：npm run build && npm run verify
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';

const ROOT = join(import.meta.dirname, '..');
const CLI = join(ROOT, 'dist', 'cli.js');
const CURRENT = join(ROOT, 'sample-data', 'current');
const PREVIOUS = join(ROOT, 'sample-data', 'previous');

interface Check {
  id: string;
  title: string;
  pass: boolean;
  evidence: string;
}
const checks: Check[] = [];
function check(id: string, title: string, pass: boolean, evidence: string): void {
  checks.push({ id, title, pass, evidence });
}

function runCli(args: string[]): { out: string; ms: number } {
  const outDir = mkdtempSync(join(tmpdir(), 'exam-verify-'));
  const started = performance.now();
  execFileSync(process.execPath, [CLI, 'build', ...args, '--out', outDir], { stdio: 'pipe' });
  return { out: outDir, ms: performance.now() - started };
}

// ---------- 原始資料（以 iconv-lite 獨立解碼，不使用專案的解碼器） ----------

interface RawStudent {
  file: string;
  studentId: string;
  name: string;
}

function decodeRaw(bytes: Buffer): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return bytes.subarray(3).toString('utf8');
  return iconv.decode(bytes, 'cp950');
}

async function readRawStudents(dir: string): Promise<RawStudent[]> {
  const students: RawStudent[] = [];
  for (const file of readdirSync(dir).sort()) {
    let rows: string[][];
    if (file.endsWith('.csv')) {
      rows = decodeRaw(readFileSync(join(dir, file)))
        .split(/\r?\n/)
        .map((line) => line.split(','));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(join(dir, file));
      rows = [];
      workbook.worksheets[0]?.eachRow((row) => {
        // cell.text 為儲存格顯示的文字（數字、Rich Text 皆可）
        rows.push(Array.from({ length: row.cellCount }, (_, i) => row.getCell(i + 1).text));
      });
    }
    const header = rows[0] ?? [];
    const idCol = header.indexOf('學號');
    const nameCol = header.indexOf('姓名');
    for (const row of rows.slice(1)) {
      const name = row[nameCol] ?? '';
      if (name !== '') students.push({ file, studentId: row[idCol] ?? '', name });
    }
  }
  return students;
}

// ---------- 從 xlsx 總表讀回成績 ----------

interface SheetRow {
  className: string;
  studentId: string;
  name: string;
  scores: (number | '缺考')[];
  rank: number | null;
  pr: number | null;
  absentCount: number;
}

async function readGradeSheet(path: string): Promise<{ sheetNames: string[]; rows: SheetRow[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet('全年級');
  const rows: SheetRow[] = [];
  sheet?.eachRow((row, i) => {
    const v = (row.values as unknown[]).slice(1);
    if (i === 1 || typeof v[2] !== 'string' || v[2] === '') return;
    rows.push({
      className: String(v[0]),
      studentId: v[2],
      name: String(v[3]),
      scores: v.slice(4, 12).map((s) => (typeof s === 'number' ? s : '缺考')),
      absentCount: Number(v[14]),
      rank: typeof v[15] === 'number' ? v[15] : null,
      pr: typeof v[16] === 'number' ? v[16] : null,
    });
  });
  return { sheetNames: workbook.worksheets.map((w) => w.name), rows };
}

const tenths = (scores: SheetRow['scores']): number[] =>
  scores.flatMap((s) => (s === '缺考' ? [] : [Math.round(s * 10)]));

// ---------- 從 HTML 擷取表格中的學號 ----------

function idsInTable(html: string, caption: string): string[] {
  const start = html.indexOf(`<caption>${caption}`);
  if (start < 0) return [];
  const end = html.indexOf('</table>', start);
  return [...html.slice(start, end).matchAll(/<td>(\d{7})<\/td>/g)].map((m) => m[1] ?? '');
}

// ---------- 開始驗收 ----------

const full = runCli([CURRENT, '--prev', PREVIOUS]);
const pub = runCli([CURRENT, '--prev', PREVIOUS, '--public']);
const prevOnly = runCli([PREVIOUS]);
const fullHtml = readFileSync(join(full.out, 'exam-report.html'), 'utf8');
const publicHtml = readFileSync(join(pub.out, 'exam-report-public.html'), 'utf8');

check(
  'A1',
  'npm install 後一個 CLI 指令即可產出 HTML 報表與 .xlsx 總表',
  readdirSync(full.out).sort().join(',') === 'exam-report.html,exam-scores.xlsx',
  `輸出檔：${readdirSync(full.out).sort().join('、')}`,
);

const rawCurrent = await readRawStudents(CURRENT);
const sources = new Set(rawCurrent.map((s) => s.file.replace(/\.\w+$/, '')));
const missingNames = rawCurrent.filter((s) => !fullHtml.includes(s.name));
const garbled = rawCurrent.filter((s) => /[?\uFFFD]/.test(s.name));
check(
  'A2',
  '兩種來源的檔案都能匯入，所有姓名完整顯示、沒有亂碼或問號',
  sources.size === 12 && missingNames.length === 0 && garbled.length === 0 && !/\uFFFD/.test(fullHtml),
  `原始檔（以 iconv-lite 獨立解碼）共 ${rawCurrent.length} 位姓名，報表中缺少 ${missingNames.length} 位；含 ? 或 U+FFFD 的姓名 ${garbled.length} 位`,
);

const issues = fullHtml.slice(fullHtml.indexOf('<section id="issues">'));
const expectedIssues: [string, string, string][] = [
  // 報表中的雙引號經 HTML 跳脫為 &quot;
  ['701.csv', '9', '&quot;101&quot;'],
  ['706.xlsx', '5', '&quot;-5&quot;'],
  ['708.csv', '11', '&quot;八十&quot;'],
  ['709.csv', '13', '缺少學號'],
];
const foundIssues = expectedIssues.filter(([file, row, text]) =>
  new RegExp(`<td>${file.replace('.', '\\.')}</td><td class="num">${row}</td>.*?${text}`).test(issues),
);
check(
  'A5',
  '分數 101、-5、「八十」、空學號的列都出現在匯入問題清單，並附檔名與列號',
  foundIssues.length === expectedIssues.length,
  `找到 ${foundIssues.length}/${expectedIssues.length}：${foundIssues.map(([f, r]) => `${f} 第 ${r} 列`).join('、')}`,
);

check(
  'A6',
  '學號跨檔重複時，問題清單列出兩個來源檔案與列號',
  /<td>711\.xlsx<\/td><td class="num">16<\/td>.*?學號重複.*?1120715.*?707\.csv 第 16 列/.test(issues),
  '711.xlsx 第 16 列（學號 1120715）↔ 707.csv 第 16 列',
);

// 排名與 PR：從 xlsx 讀回分數，以最直接的定義重算
const grade = await readGradeSheet(join(full.out, 'exam-scores.xlsx'));
const eligible = grade.rows.filter((r) => r.absentCount === 0);
const totals = eligible.map((r) => tenths(r.scores).reduce((a, b) => a + b, 0));
let rankMismatch = 0;
let prMismatch = 0;
eligible.forEach((r, i) => {
  const mine = totals[i] ?? 0;
  const above = totals.filter((t) => t > mine).length;
  const below = totals.filter((t) => t < mine).length;
  const same = totals.filter((t) => t === mine).length;
  const pr = Math.min(99, Math.max(1, Math.round((100 * (below + 0.5 * same)) / totals.length)));
  if (r.rank !== above + 1) rankMismatch++;
  if (r.pr !== pr) prMismatch++;
});
const tiedRanks = new Set(eligible.map((r) => r.rank).filter((x, i, a) => a.indexOf(x) !== i));
check(
  'A7',
  '同分同名次與跳號、PR 值公式與上下限（以輸出總表獨立重算比對）',
  rankMismatch === 0 && prMismatch === 0 && tiedRanks.size > 0,
  `${eligible.length} 位參與排名者：名次不符 ${rankMismatch}、PR 不符 ${prMismatch}；範例中有 ${tiedRanks.size} 組同分名次`,
);

const absentRanked = grade.rows.filter((r) => r.absentCount > 0 && (r.rank !== null || r.pr !== null));
const excludedInHtml = fullHtml.slice(fullHtml.indexOf('id="excluded"'), fullHtml.indexOf('id="comparison"'));
const absentees = grade.rows.filter((r) => r.absentCount > 0);
check(
  'A8',
  '有缺考科目的學生不參與排名，另外列在報表中',
  absentRanked.length === 0 && absentees.length > 0 && absentees.every((r) => excludedInHtml.includes(r.studentId)),
  `缺考學生 ${absentees.length} 位（${absentees.map((r) => r.studentId).join('、')}），皆無名次／PR，且列於「有缺考科目的學生」`,
);

// 進步／退步：用上次段考單獨產生的總表重算
const prevGrade = await readGradeSheet(join(prevOnly.out, 'exam-scores.xlsx'));
const avg = (r: SheetRow): number => {
  const t = tenths(r.scores);
  return t.reduce((a, b) => a + b, 0) / t.length / 10;
};
const prevById = new Map(prevGrade.rows.map((r) => [r.studentId, r]));
const deltas = grade.rows.flatMap((r) => {
  const p = prevById.get(r.studentId);
  return p === undefined ? [] : [{ id: r.studentId, delta: avg(r) - avg(p) }];
});
const byDelta = (a: { id: string; delta: number }, b: { id: string; delta: number }): number =>
  Math.abs(a.delta - b.delta) < 1e-9 ? (a.id < b.id ? -1 : 1) : 0;
const top = [...deltas].filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta || byDelta(a, b)).slice(0, 10);
const bottom = [...deltas].filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta || byDelta(a, b)).slice(0, 10);
const improvedHtml = idsInTable(fullHtml, '進步前 10 名');
const declinedHtml = idsInTable(fullHtml, '退步前 10 名');
const transferIn = idsInTable(fullHtml, '轉入');
const transferOut = idsInTable(fullHtml, '轉出');
check(
  'A10',
  '與上次段考比較：進步、退步前 10 名正確，轉入、轉出有標示',
  improvedHtml.join() === top.map((d) => d.id).join() &&
    declinedHtml.join() === bottom.map((d) => d.id).join() &&
    transferIn.join() === '1129001,1129002' &&
    transferOut.join() === '1120330,1120930',
  `進步榜 ${improvedHtml.length} 人、退步榜 ${declinedHtml.length} 人與獨立重算一致；轉入 ${transferIn.join('、')}；轉出 ${transferOut.join('、')}`,
);

const externalPatterns = [/https?:\/\//i, /<script\b/i, /<link\b/i, /@import/i, /url\(/i];
const srcFiles = execFileSync('git', ['ls-files', 'src', 'config', 'scripts'], { cwd: ROOT, encoding: 'utf8' })
  .trim()
  .split('\n');
const srcWithUrl = srcFiles.filter((f) => /https?:\/\//i.test(readFileSync(join(ROOT, f), 'utf8')));
check(
  'A11',
  'HTML 報表不引用外部資源；原始碼中搜尋不到 http:// 或 https://',
  externalPatterns.every((p) => !p.test(fullHtml) && !p.test(publicHtml)) && srcWithUrl.length === 0,
  `報表中 script／link／@import／url()／網址皆為 0；${srcFiles.length} 個原始碼檔案中含網址 ${srcWithUrl.length} 個；內嵌 SVG ${(fullHtml.match(/<svg /g) ?? []).length} 張`,
);

const rawAll = [...rawCurrent, ...(await readRawStudents(PREVIOUS))];
const leakedNames = [...new Set(rawAll.map((s) => s.name))].filter((n) => publicHtml.includes(n));
const leakedIds = [...new Set(rawAll.map((s) => s.studentId).filter((id) => id !== ''))].filter((id) => publicHtml.includes(id));
check(
  'A12',
  '公開版報表中搜尋不到任何學生姓名與完整學號',
  leakedNames.length === 0 && leakedIds.length === 0 && readdirSync(pub.out).join() === 'exam-report-public.html',
  `比對兩次段考原始檔中 ${new Set(rawAll.map((s) => s.name)).size} 個姓名、${new Set(rawAll.map((s) => s.studentId)).size} 個學號：外洩 0；公開模式只輸出 ${readdirSync(pub.out).join('、')}`,
);

check(
  'A13',
  '.xlsx 總表的工作表數量為班級數加 1',
  grade.sheetNames.length === 13 && grade.sheetNames[0] === '全年級',
  `工作表：${grade.sheetNames.join('、')}`,
);

check(
  'A14',
  '範例資料（12 班）從執行指令到產出報表在 10 秒內完成',
  full.ms < 10_000,
  `含 Node 啟動，完整版（含比較）${(full.ms / 1000).toFixed(2)} 秒`,
);

const allPass = checks.every((c) => c.pass);
console.log('| 編號 | 驗收項目 | 結果 | 證據 |\n|---|---|---|---|');
for (const c of checks) {
  console.log(`| ${c.id} | ${c.title} | ${c.pass ? '✅ 通過' : '❌ 未通過'} | ${c.evidence} |`);
}
console.log(`\n${allPass ? '全部通過' : '有未通過項目'}（${checks.filter((c) => c.pass).length}/${checks.length}）`);
process.exitCode = allPass ? 0 : 1;
