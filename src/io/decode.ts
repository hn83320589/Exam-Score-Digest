import type { TextEncoding } from './raw-table.js';

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return UTF8_BOM.every((byte, i) => bytes[i] === byte);
}

/**
 * 繁中 Windows 環境下的 CSV 只會是兩種編碼：
 * Excel「CSV UTF-8」另存為 UTF-8 + BOM；校務系統匯出與 Excel「CSV（逗號分隔）」為 Big5（CP950）。
 * 先以嚴格模式嘗試 UTF-8，失敗才視為 Big5，避免把 UTF-8 誤判成 Big5 而產生亂碼。
 */
export function decodeText(bytes: Uint8Array): { text: string; encoding: Exclude<TextEncoding, 'xlsx'> } {
  if (hasUtf8Bom(bytes)) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(UTF8_BOM.length)), encoding: 'utf-8-bom' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    // 不是合法的 UTF-8 位元組序列，改用 Big5 解碼
    return { text: new TextDecoder('big5').decode(bytes), encoding: 'big5' };
  }
}
