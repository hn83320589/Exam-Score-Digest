import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/load.js';
import { importFolder, type ImportResult } from '../src/io/import-folder.js';

const SAMPLE = join(import.meta.dirname, '..', 'sample-data');

describe('範例資料匯入（scripts/generate-sample.ts 產生）', () => {
  let current: ImportResult;

  beforeAll(async () => {
    current = await importFolder(join(SAMPLE, 'current'), await loadConfig());
  });

  it('12 個班級全部匯入，兩種來源的 CSV 與 xlsx 都包含在內', () => {
    const classes = new Set(current.students.map((s) => s.className));

    expect([...classes].sort()).toEqual(['701', '702', '703', '704', '705', '706', '707', '708', '709', '710', '711', '712']);
    expect(current.issues.filter((i) => i.kind === 'file-error')).toEqual([]);
  });

  it('所有學生姓名完整顯示，沒有亂碼或問號', () => {
    for (const student of current.students) {
      expect(student.name).toMatch(/^[一-鿿]{2,4}$/);
    }
  });

  it('101、-5、「八十」、85.55 與空學號都列入問題清單並附檔名與列號', () => {
    const rows = current.issues
      .filter((i) => i.kind === 'invalid-score' || i.kind === 'missing-id')
      .map((i) => `${i.file}:${i.row}`);

    expect(rows).toEqual(['701.csv:9', '706.xlsx:5', '708.csv:11', '709.csv:13', '710.xlsx:3']);
    const messages = current.issues.map((i) => i.message).join('\n');
    for (const value of ['"101"', '"-5"', '"八十"', '"85.55"', '缺少學號']) {
      expect(messages).toContain(value);
    }
  });

  it('跨檔重複學號列出兩個來源檔案與列號', () => {
    const duplicate = current.issues.find((i) => i.kind === 'duplicate-id');

    expect(duplicate).toMatchObject({
      file: '711.xlsx',
      row: 16,
      studentId: '1120715',
      related: [{ file: '707.csv', row: 16 }],
    });
  });

  it('全形數字與缺考正確解析', () => {
    const absent = current.students.filter((s) => [...s.scores.values()].some((v) => v.kind === 'absent'));

    expect(absent.map((s) => `${s.className}-${s.seat}`).sort()).toEqual(['702-5', '702-6', '702-7', '709-3']);
    const zero = current.students.find((s) => s.className === '704' && s.seat === '3');
    expect(zero?.scores.get('數學')).toEqual({ kind: 'present', tenths: 0 });
  });
});
