export type TextEncoding = 'utf-8-bom' | 'utf-8' | 'big5' | 'xlsx';

export interface RawRow {
  /** 與 Excel 畫面一致的列號：標題列為第 1 列。 */
  rowNumber: number;
  cells: string[];
  /**
   * xlsx 中「有公式但沒有快取計算結果」的欄位索引。部分程式庫產生的 xlsx 不會寫入計算結果，
   * 這些儲存格讀到的是空字串，若直接當成空白就會被誤判為缺考。
   */
  uncachedFormulaColumns?: number[];
}

/** 讀檔後、尚未套用任何業務規則的表格。 */
export interface RawTable {
  file: string;
  encoding: TextEncoding;
  headers: string[];
  rows: RawRow[];
}
