import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { readCsv } from '../src/io/read-csv.js';
import { readXlsx } from '../src/io/read-xlsx.js';

describe('readCsv', () => {
  it('以 Excel 列號編號（標題列為第 1 列），處理引號與 CRLF', () => {
    const bytes = iconv.encode('學號,姓名,備註\r\n1120001,王小明,"含,逗號"\r\n\r\n1120002,李大華,\r\n', 'cp950');

    const table = readCsv('701.csv', bytes);

    expect(table.file).toBe('701.csv');
    expect(table.encoding).toBe('big5');
    expect(table.headers).toEqual(['學號', '姓名', '備註']);
    expect(table.rows).toEqual([
      { rowNumber: 2, cells: ['1120001', '王小明', '含,逗號'] },
      { rowNumber: 3, cells: [''] },
      { rowNumber: 4, cells: ['1120002', '李大華', ''] },
    ]);
  });
});

async function buildXlsx(fill: (sheet: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  fill(workbook.addWorksheet('成績'));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('readXlsx', () => {
  it('數字儲存格、公式結果、Rich Text 都轉為字串，空白列保留列號', async () => {
    const bytes = await buildXlsx((sheet) => {
      sheet.addRow(['學號', '姓名', '國文', '總分']);
      sheet.addRow([1120001, { richText: [{ text: '王' }, { text: '小明' }] }, 85.5, { formula: 'C2', result: 85.5 }]);
      sheet.addRow([]);
      sheet.addRow([1120002, '李大華', null, null]);
    });

    const table = await readXlsx('710.xlsx', bytes);

    expect(table.headers).toEqual(['學號', '姓名', '國文', '總分']);
    expect(table.rows).toEqual([
      { rowNumber: 2, cells: ['1120001', '王小明', '85.5', '85.5'] },
      { rowNumber: 4, cells: ['1120002', '李大華', '', ''] },
    ]);
  });

  it('有公式但沒有快取計算結果的儲存格，記錄其欄位而不是當成空白', async () => {
    const bytes = await buildXlsx((sheet) => {
      sheet.addRow(['學號', '國文', '英語']);
      sheet.addRow(['1120001', { formula: 'B1+1' }, { formula: '80', result: 80 }]);
    });

    const table = await readXlsx('701.xlsx', bytes);

    expect(table.rows).toEqual([{ rowNumber: 2, cells: ['1120001', '', '80'], uncachedFormulaColumns: [1] }]);
  });

  it('公式計算產生的浮點誤差還原為一位小數', async () => {
    const bytes = await buildXlsx((sheet) => {
      sheet.addRow(['國文']);
      sheet.addRow([{ formula: '0.1*3*100', result: 0.1 * 3 * 100 }]);
    });

    const table = await readXlsx('701.xlsx', bytes);

    expect(table.rows[0]?.cells).toEqual(['30']);
  });
});
