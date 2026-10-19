import { describe, expect, it } from 'vitest';
import { classFromFileName, normalizeTable } from '../src/domain/normalize.js';
import { validateConfig } from '../src/config/schema.js';
import type { RawTable } from '../src/io/raw-table.js';

const SUBJECTS = ['國文', '英語', '數學', '自然', '歷史', '地理', '公民', '健康'];
const config = validateConfig({
  subjects: SUBJECTS.map((name) => ({ name, aliases: name === '國文' ? ['國語文'] : [] })),
});

function table(file: string, headers: string[], rows: string[][]): RawTable {
  return {
    file,
    encoding: 'utf-8',
    headers,
    rows: rows.map((cells, i) => ({ rowNumber: i + 2, cells })),
  };
}

const HEADERS = ['班級', '座號', '學號', '姓名', ...SUBJECTS];
const GOOD = ['80', '81', '82', '83', '84', '85', '86', '87'];

describe('classFromFileName', () => {
  it.each([
    ['701.csv', '701'],
    ['七年級-712班成績.xlsx', '712'],
    ['成績.csv', undefined],
  ])('%s → %s', (file, expected) => {
    expect(classFromFileName(file)).toBe(expected);
  });
});

describe('normalizeTable', () => {
  it('正常列轉成 StudentRecord，保留來源檔名與列號', () => {
    const result = normalizeTable(table('701.csv', HEADERS, [['701', '1', '1120001', '王小明', ...GOOD]]), config);

    expect(result.issues).toEqual([]);
    expect(result.students).toHaveLength(1);
    const student = result.students[0];
    expect(student?.studentId).toBe('1120001');
    expect(student?.scores.get('國文')).toEqual({ kind: 'present', tenths: 800 });
    expect(student?.source).toEqual({ file: '701.csv', row: 2 });
  });

  it('101、-5、「八十」與空學號的列都被跳過並列入問題清單（含檔名與列號）', () => {
    const bad = (i: number, value: string): string[] => GOOD.map((g, j) => (j === i ? value : g));
    const result = normalizeTable(
      table('703.csv', HEADERS, [
        ['703', '1', '1120101', '甲', ...bad(0, '101')],
        ['703', '2', '1120102', '乙', ...bad(1, '-5')],
        ['703', '3', '1120103', '丙', ...bad(2, '八十')],
        ['703', '4', '', '丁', ...GOOD],
        ['703', '5', '1120105', '戊', ...GOOD],
      ]),
      config,
    );

    expect(result.students.map((s) => s.studentId)).toEqual(['1120105']);
    expect(result.issues.map((i) => [i.kind, i.file, i.row])).toEqual([
      ['invalid-score', '703.csv', 2],
      ['invalid-score', '703.csv', 3],
      ['invalid-score', '703.csv', 4],
      ['missing-id', '703.csv', 5],
    ]);
    expect(result.issues[0]?.message).toContain('國文');
    expect(result.issues[0]?.message).toContain('101');
    expect(result.issues[0]?.studentId).toBe('1120101');
    // 學號空白的列也記下班級與座號，供比較功能判斷
    expect(result.issues[3]?.classSeat).toEqual({ className: '703', seat: '4' });
  });

  it('缺考保留為 absent，不視為錯誤', () => {
    const result = normalizeTable(
      table('701.csv', HEADERS, [['701', '1', '1120001', '王小明', '缺', '', ...GOOD.slice(2)]]),
      config,
    );

    expect(result.issues).toEqual([]);
    expect(result.students[0]?.scores.get('國文')).toEqual({ kind: 'absent' });
    expect(result.students[0]?.scores.get('英語')).toEqual({ kind: 'absent' });
  });

  it('沒有班級欄時從檔名取得班級', () => {
    const headers = ['座號', '學號', '姓名', '國語文', ...SUBJECTS.slice(1)];
    const result = normalizeTable(table('708.csv', headers, [['1', '1120201', '王小明', ...GOOD]]), config);

    expect(result.students[0]?.className).toBe('708');
  });

  it('完全空白的列靜默略過', () => {
    const result = normalizeTable(table('701.csv', HEADERS, [[''], HEADERS.map(() => ' ')]), config);

    expect(result).toEqual({ students: [], issues: [] });
  });

  it('缺少必要欄位時整個檔案列為問題並跳過', () => {
    const result = normalizeTable(table('701.csv', ['學號', '姓名'], [['1120001', '王小明']]), config);

    expect(result.students).toEqual([]);
    expect(result.issues).toMatchObject([{ kind: 'file-error', file: '701.csv', row: 1 }]);
  });

  it('不認得的欄位列為警告但照常匯入', () => {
    const result = normalizeTable(
      table('701.csv', [...HEADERS, '社團'], [['701', '1', '1120001', '王小明', ...GOOD, '桌球']]),
      config,
    );

    expect(result.students).toHaveLength(1);
    expect(result.issues).toMatchObject([{ kind: 'unknown-column', row: 1 }]);
  });
});
