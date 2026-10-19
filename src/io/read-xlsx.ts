import ExcelJS from 'exceljs';
import type { RawTable } from './raw-table.js';

const FLOAT_TOLERANCE = 1e-9;

/** 公式運算可能產生 29.999999999999996 這類誤差，貼近一位小數時還原。 */
function numberToText(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(Math.abs(value - rounded) < FLOAT_TOLERANCE ? rounded : value);
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return numberToText(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('error' in value) return value.error;
  if ('result' in value) return cellToText(value.result);
  if ('text' in value) return value.text;
  return '';
}

/** 只讀第一個工作表；完全空白的列 ExcelJS 不會回傳。 */
export async function readXlsx(file: string, bytes: Uint8Array): Promise<RawTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) {
    throw new Error('活頁簿中沒有任何工作表');
  }

  const columnCount = sheet.columnCount;
  const toCells = (row: ExcelJS.Row): string[] =>
    Array.from({ length: columnCount }, (_, i) => cellToText(row.getCell(i + 1).value));

  const headers: string[] = [];
  const rows: RawTable['rows'] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) headers.push(...toCells(row));
    else rows.push({ rowNumber, cells: toCells(row) });
  });

  return { file, encoding: 'xlsx', headers, rows };
}
