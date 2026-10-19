import { parse } from 'csv-parse/sync';
import { decodeText } from './decode.js';
import type { RawTable } from './raw-table.js';

export function readCsv(file: string, bytes: Uint8Array): RawTable {
  const { text, encoding } = decodeText(bytes);
  const records: string[][] = parse(text, { relax_column_count: true, relax_quotes: true });
  const [headers = [], ...rows] = records;

  return {
    file,
    encoding,
    headers,
    // 以紀錄序號計列號：欄位內含換行時，Excel 仍顯示為同一列
    rows: rows.map((cells, i) => ({ rowNumber: i + 2, cells })),
  };
}
