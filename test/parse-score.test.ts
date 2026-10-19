import { describe, expect, it } from 'vitest';
import { parseScore } from '../src/domain/parse-score.js';

const ABSENT = ['缺', '缺考'];

describe('parseScore', () => {
  it.each([
    ['85', 850],
    ['0', 0],
    ['100', 1000],
    ['89.9', 899],
    ['60.0', 600],
    ['  72 ', 720],
  ])('有效分數 %j → %i 十分位', (raw, tenths) => {
    expect(parseScore(raw, ABSENT)).toEqual({ kind: 'present', tenths });
  });

  it('全形數字經 NFKC 正規化後視為有效分數', () => {
    expect(parseScore('８５．５', ABSENT)).toEqual({ kind: 'present', tenths: 855 });
  });

  it.each(['缺', '缺考', '', '   ', '　'])('%j 視為缺考', (raw) => {
    expect(parseScore(raw, ABSENT)).toEqual({ kind: 'absent' });
  });

  it('0 分與缺考是不同結果', () => {
    expect(parseScore('0', ABSENT)).not.toEqual(parseScore('缺', ABSENT));
  });

  it.each([
    ['101', '超出範圍'],
    ['-5', '超出範圍'],
    ['100.1', '超出範圍'],
    ['85.55', '小數'],
    ['八十', '無法解析'],
    ['85分', '無法解析'],
    ['請假', '無法解析'],
  ])('%j 為錯誤分數，原因含「%s」', (raw, reasonPart) => {
    const result = parseScore(raw, ABSENT);
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toContain(reasonPart);
  });
});
