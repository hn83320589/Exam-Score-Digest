/** 全形轉半形（NFKC）並去除前後空白。 */
export function normalizeCell(value: string): string {
  return value.normalize('NFKC').trim();
}

/** 欄名比對用：NFKC 後移除所有空白（含全形空白），避免導師手打的空白造成比對失敗。 */
export function normalizeHeader(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '');
}
