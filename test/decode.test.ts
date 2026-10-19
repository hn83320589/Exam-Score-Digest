import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { decodeText } from '../src/io/decode.js';

const SAMPLE = '班級,座號,學號,姓名,國語文\r\n701,1,1120001,陳怡君,85';

describe('decodeText', () => {
  it('UTF-8 含 BOM（Excel「CSV UTF-8」另存）', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from(SAMPLE, 'utf8')]);

    expect(decodeText(bytes)).toEqual({ text: SAMPLE, encoding: 'utf-8-bom' });
  });

  it('UTF-8 不含 BOM', () => {
    expect(decodeText(Buffer.from(SAMPLE, 'utf8'))).toEqual({ text: SAMPLE, encoding: 'utf-8' });
  });

  it('Big5／CP950（校務系統匯出、Excel「CSV（逗號分隔）」另存）', () => {
    expect(decodeText(iconv.encode(SAMPLE, 'cp950'))).toEqual({ text: SAMPLE, encoding: 'big5' });
  });
});
