export type TextEncoding = 'utf-8-bom' | 'utf-8' | 'big5' | 'xlsx';

export interface RawRow {
  /** 與 Excel 畫面一致的列號：標題列為第 1 列。 */
  rowNumber: number;
  cells: string[];
}

/** 讀檔後、尚未套用任何業務規則的表格。 */
export interface RawTable {
  file: string;
  encoding: TextEncoding;
  headers: string[];
  rows: RawRow[];
}
