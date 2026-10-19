import { describe, expect, it } from 'vitest';
import { mapHeaders } from '../src/domain/map-headers.js';
import { validateConfig } from '../src/config/schema.js';

const config = validateConfig({
  subjects: [
    { name: '國文', aliases: ['國語文'] },
    { name: '英語', aliases: ['英文'] },
    { name: '數學', aliases: [] },
    { name: '自然', aliases: [] },
    { name: '歷史', aliases: [] },
    { name: '地理', aliases: [] },
    { name: '公民', aliases: [] },
    { name: '健康', aliases: [] },
  ],
});

const META = ['班級', '座號', '學號', '姓名'];
const STANDARD = ['國文', '英語', '數學', '自然', '歷史', '地理', '公民', '健康'];

describe('mapHeaders', () => {
  it('「國語文」與「國文」對應到同一個標準科目', () => {
    const a = mapHeaders([...META, ...STANDARD], config);
    const b = mapHeaders([...META, '國語文', '英文', ...STANDARD.slice(2)], config);

    expect(a.ok && a.columns.subjects.get('國文')).toBe(4);
    expect(b.ok && b.columns.subjects.get('國文')).toBe(4);
    expect(b.ok && b.columns.subjects.get('英語')).toBe(5);
  });

  it('欄名中的空白與全形字元不影響比對', () => {
    const result = mapHeaders([' 班級', '座　號', '學號', '姓名 ', ...STANDARD], config);

    expect(result.ok && result.columns.seat).toBe(1);
  });

  it('沒有班級欄時 className 為 undefined', () => {
    const result = mapHeaders(['座號', '學號', '姓名', ...STANDARD], config);

    expect(result.ok).toBe(true);
    expect(result.ok && result.columns.className).toBeUndefined();
  });

  it('未知欄位列為 unknown，忽略清單與空白欄名不列入', () => {
    const result = mapHeaders([...META, ...STANDARD, '總分', '', '社團'], config);

    expect(result.ok && result.unknown).toEqual(['社團']);
  });

  it('缺少科目或學號欄時回報缺少的欄位', () => {
    const result = mapHeaders(['班級', '座號', '姓名', ...STANDARD.slice(1)], config);

    expect(result).toEqual({ ok: false, error: '缺少必要欄位：學號、國文' });
  });

  it('兩個欄位對應到同一科時回報錯誤', () => {
    const result = mapHeaders([...META, ...STANDARD, '國語文'], config);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('國文');
  });
});
