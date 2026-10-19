/** 全形轉半形（NFKC）並去除前後空白。 */
export function normalizeCell(value: string): string {
  return value.normalize('NFKC').trim();
}

const PRIVATE_USE = /[-]/u;

/**
 * 找出來源檔中就已損壞、無法正確顯示的字元：
 * - 「?」：Excel 以 ANSI（CP950）另存時，CP950 無法表示的罕用字會被換成問號
 * - U+E000–U+F8FF：CP950 造字區（如 0xFA40）解碼後落在私用區，沒有造字檔的電腦會顯示成空白或方框
 * - U+FFFD：解碼失敗的替代字元
 * 回傳可讀的標示（例如 "?"、"U+E000"），沒有問題時回傳空陣列。
 */
export function findUnreadableChars(text: string): string[] {
  const found = new Set<string>();
  for (const ch of text) {
    if (ch === '?' || ch === '？') found.add(ch);
    else if (ch === '�' || PRIVATE_USE.test(ch)) {
      found.add(`U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }
  return [...found];
}

/** 欄名比對用：NFKC 後移除所有空白（含全形空白），避免導師手打的空白造成比對失敗。 */
export function normalizeHeader(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '');
}
