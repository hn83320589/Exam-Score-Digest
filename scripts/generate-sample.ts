/**
 * 產生範例資料：本次段考（sample-data/current）與上次段考（sample-data/previous）。
 *
 * 執行：npm run sample
 *
 * 固定亂數種子，每次產生的檔案內容都相同。刻意放入的異常資料列在 ANOMALIES，
 * 整合測試與 README 都以這份清單為準。
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';

const ROOT = join(import.meta.dirname, '..', 'sample-data');
const SEED = 20261019;

const STANDARD_HEADERS = ['國文', '英語', '數學', '自然', '歷史', '地理', '公民', '健康'];
const TEACHER_HEADERS = ['國語文', '英文', '數學', '自然科學', '歷史', '地理', '公民與社會', '健康教育'];

const SURNAMES =
  '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余趙盧梁顏柯翁魏孫戴范宋方鄧杜傅侯曹薛丁卓阮馬董唐藍蔣石古紀姚連馮歐程湯黎田康姜汪白鄒';
const GIVEN_NAMES = [
  '怡君', '雅婷', '欣妤', '宜庭', '家豪', '俊宏', '冠宇', '承恩', '子晴', '品妍', '宥廷', '柏翰',
  '詠晴', '瑋珣', '筱涵', '彥廷', '姿穎', '芷瑄', '宸睿', '翊安', '昱辰', '沛恩', '芊妤', '羽彤',
  '禹丞', '語彤', '思妤', '品睿', '浩宇', '亦晨', '苡安', '以晴', '語涵', '承翰', '宇恩', '宥辰',
  '彧璿', '琮瑀', '甯靚', '翾',
];

type Source = 'system-csv' | 'system-xlsx' | 'teacher-csv-big5' | 'teacher-csv-utf8' | 'teacher-xlsx';

/** 班級 → 來源格式。兩種來源（校務系統匯出、導師 Excel 另存）都包含 CSV 與 xlsx。 */
const CURRENT_SOURCES: Record<string, Source> = {
  '701': 'system-csv',
  '702': 'system-csv',
  '703': 'system-csv',
  '704': 'system-xlsx',
  '705': 'system-xlsx',
  '706': 'system-xlsx',
  '707': 'teacher-csv-big5',
  '708': 'teacher-csv-big5',
  '709': 'teacher-csv-utf8',
  '710': 'teacher-xlsx',
  '711': 'teacher-xlsx',
  '712': 'teacher-xlsx',
};
const PREVIOUS_SOURCES: Record<string, Source> = Object.fromEntries(
  Object.keys(CURRENT_SOURCES).map((c, i) => [c, i % 2 === 0 ? 'system-csv' : 'system-xlsx']),
);
const CLASS_SIZES = [30, 31, 30, 30, 31, 30, 31, 30, 30, 29, 31, 30];

/** 本次段考刻意放入的異常資料（班級, 座號 → 覆寫內容）。 */
const ANOMALIES = {
  absent: [
    { className: '702', seat: 5, subject: 0, value: '缺' },
    { className: '702', seat: 6, subject: 2, value: '缺考' },
    { className: '702', seat: 7, subject: 1, value: '' },
    { className: '709', seat: 3, subject: 4, value: '缺' },
  ],
  zero: [{ className: '704', seat: 3, subject: 2, value: '0' }],
  invalid: [
    { className: '701', seat: 8, subject: 2, value: '101' },
    { className: '706', seat: 4, subject: 3, value: '-5' },
    { className: '708', seat: 10, subject: 0, value: '八十' },
    { className: '710', seat: 2, subject: 1, value: '85.55' },
  ],
  missingId: [{ className: '709', seat: 12 }],
  /** 711 班 15 號的學號誤植成 707 班 15 號的學號。 */
  duplicateId: [{ className: '711', seat: 15, copyFrom: { className: '707', seat: 15 } }],
  /** 只出現在上次段考（轉出）。 */
  transferOut: [
    { className: '703', seat: 30 },
    { className: '709', seat: 30 },
  ],
  /** 只出現在本次段考（轉入）。 */
  transferIn: [
    { className: '705', seat: 31, studentId: '1129001' },
    { className: '711', seat: 31, studentId: '1129002' },
  ],
};

// ---------- 亂數 ----------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(SEED);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
function gaussian(mean: number, sd: number): number {
  const u = 1 - random();
  const v = random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------- 學生與分數 ----------

interface Student {
  className: string;
  seat: number;
  studentId: string;
  name: string;
  previous: string[];
  current: string[];
}

function clampScore(value: number, allowHalf: boolean): number {
  const step = allowHalf && random() < 0.3 ? 0.5 : 1;
  return Math.min(100, Math.max(0, Math.round(value / step) * step));
}

function makeStudents(): Student[] {
  const students: Student[] = [];
  Object.keys(CURRENT_SOURCES).forEach((className, classIndex) => {
    const size = CLASS_SIZES[classIndex] ?? 30;
    const classLevel = gaussian(0, 3);
    for (let seat = 1; seat <= size; seat++) {
      const ability = gaussian(72 + classLevel, 12);
      // 少數學生大幅進步或退步，讓前 10 名有明確差距
      const roll = random();
      const drift = roll < 0.04 ? gaussian(16, 3) : roll < 0.08 ? gaussian(-16, 3) : gaussian(0, 3);
      const allowHalf = className === '707' || className === '710';
      const previous: string[] = [];
      const current: string[] = [];
      for (let s = 0; s < STANDARD_HEADERS.length; s++) {
        const offset = gaussian(0, 7);
        previous.push(String(clampScore(ability + offset + gaussian(0, 4), false)));
        current.push(String(clampScore(ability + drift + offset + gaussian(0, 4), allowHalf)));
      }
      students.push({
        className,
        seat,
        studentId: `112${className.slice(1)}${String(seat).padStart(2, '0')}`,
        name: pick(Array.from(SURNAMES)) + pick(GIVEN_NAMES),
        previous,
        current,
      });
    }
  });
  return students;
}

function find(students: Student[], className: string, seat: number): Student {
  const student = students.find((s) => s.className === className && s.seat === seat);
  if (student === undefined) throw new Error(`找不到 ${className} 班 ${seat} 號`);
  return student;
}

interface ExamRow {
  className: string;
  seat: string;
  studentId: string;
  name: string;
  scores: string[];
}

function buildExams(students: Student[]): { current: ExamRow[]; previous: ExamRow[] } {
  const transferOut = new Set(ANOMALIES.transferOut.map((t) => find(students, t.className, t.seat)));
  const transferIn = new Map(ANOMALIES.transferIn.map((t) => [find(students, t.className, t.seat), t.studentId]));

  const toRow = (s: Student, scores: string[], studentId = s.studentId): ExamRow => ({
    className: s.className,
    seat: String(s.seat),
    studentId,
    name: s.name,
    scores: [...scores],
  });

  const previous = students.filter((s) => !transferIn.has(s)).map((s) => toRow(s, s.previous));
  // 上次段考也有一位缺考，驗證比較功能不受影響
  const prevAbsent = previous.find((r) => r.className === '704' && r.seat === '10');
  if (prevAbsent !== undefined) prevAbsent.scores[5] = '缺';

  const current = students
    .filter((s) => !transferOut.has(s))
    .map((s) => toRow(s, s.current, transferIn.get(s) ?? s.studentId));
  const currentRow = (className: string, seat: number): ExamRow => {
    const row = current.find((r) => r.className === className && r.seat === String(seat));
    if (row === undefined) throw new Error(`找不到本次 ${className} 班 ${seat} 號`);
    return row;
  };

  for (const a of [...ANOMALIES.absent, ...ANOMALIES.zero, ...ANOMALIES.invalid]) {
    currentRow(a.className, a.seat).scores[a.subject] = a.value;
  }
  for (const a of ANOMALIES.missingId) currentRow(a.className, a.seat).studentId = '';
  for (const a of ANOMALIES.duplicateId) {
    currentRow(a.className, a.seat).studentId = find(students, a.copyFrom.className, a.copyFrom.seat).studentId;
  }
  // 導師手打的全形數字
  for (const row of current.filter((r) => r.className === '709').slice(0, 5)) {
    row.scores[0] = (row.scores[0] ?? '').replace(/\d/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));
  }
  return { current, previous };
}

// ---------- 輸出 ----------

function assertCp950(text: string, file: string): void {
  const roundTrip = new TextDecoder('big5').decode(iconv.encode(text, 'cp950'));
  if (roundTrip !== text) {
    throw new Error(`${file} 含有 CP950 無法表示的字元，Windows Excel 存檔後會變成問號`);
  }
}

function csvLine(cells: readonly string[]): string {
  return cells.map((c) => (/[",\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',');
}

async function writeCsv(path: string, header: string[], body: string[][], encoding: 'cp950' | 'utf8-bom'): Promise<void> {
  const text = [header, ...body].map(csvLine).join('\r\n') + '\r\n';
  if (encoding === 'cp950') {
    assertCp950(text, path);
    await writeFile(path, iconv.encode(text, 'cp950'));
  } else {
    await writeFile(path, '﻿' + text, 'utf8');
  }
}

async function writeExam(dir: string, rows: ExamRow[], sources: Record<string, Source>): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  for (const [className, source] of Object.entries(sources)) {
    const classRows = rows.filter((r) => r.className === className);
    const isTeacher = source.startsWith('teacher');
    const subjects = isTeacher ? TEACHER_HEADERS : STANDARD_HEADERS;

    if (source === 'system-csv') {
      const header = ['班級', '座號', '學號', '姓名', ...subjects];
      const body = classRows.map((r) => [r.className, r.seat, r.studentId, r.name, ...r.scores]);
      await writeCsv(join(dir, `${className}.csv`), header, body, 'cp950');
    } else if (source === 'teacher-csv-big5' || source === 'teacher-csv-utf8') {
      // 導師另存：沒有班級欄（由檔名判斷），尾端留有 Excel 的空白列
      const header = ['座號', '學號', '姓名', ...subjects];
      const body = classRows.map((r) => [r.seat, r.studentId, r.name, ...r.scores]);
      body.push(header.map(() => ''), header.map(() => ''));
      await writeCsv(join(dir, `${className}.csv`), header, body, source === 'teacher-csv-big5' ? 'cp950' : 'utf8-bom');
    } else {
      await writeXlsx(join(dir, `${className}.xlsx`), classRows, subjects, isTeacher);
    }
  }
}

async function writeXlsx(path: string, rows: ExamRow[], subjects: string[], isTeacher: boolean): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  // 固定文件屬性中的時間（zip 內部的檔案時間由 ExcelJS 決定，無法固定）
  workbook.created = workbook.modified = new Date('2026-10-01T00:00:00Z');
  const sheet = workbook.addWorksheet(isTeacher ? '工作表1' : '成績');
  const toCell = (value: string): string | number => (isTeacher && /^\d+(\.\d)?$/.test(value) ? Number(value) : value);

  if (isTeacher) {
    // 導師另存：學號被 Excel 轉成數字、自行加上總分公式欄，最後有空白列
    sheet.addRow(['座號', '學號', '姓名', ...subjects, '總分']);
    rows.forEach((r, i) => {
      const excelRow = i + 2;
      const scores = r.scores.map(toCell);
      sheet.addRow([
        Number(r.seat),
        r.studentId === '' ? null : Number(r.studentId),
        r.name,
        ...scores,
        { formula: `SUM(D${excelRow}:K${excelRow})` },
      ]);
    });
    sheet.addRow([]);
    sheet.addRow([null, null, null]);
  } else {
    sheet.addRow(['班級', '座號', '學號', '姓名', ...subjects]);
    for (const r of rows) sheet.addRow([r.className, r.seat, r.studentId, r.name, ...r.scores]);
  }
  await workbook.xlsx.writeFile(path);
}

const students = makeStudents();
const exams = buildExams(students);
await writeExam(join(ROOT, 'current'), exams.current, CURRENT_SOURCES);
await writeExam(join(ROOT, 'previous'), exams.previous, PREVIOUS_SOURCES);
console.log(`已產生範例資料：本次 ${exams.current.length} 人、上次 ${exams.previous.length} 人 → ${ROOT}`);
