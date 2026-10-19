import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildReportModel } from '../src/report/model.js';
import { createScoreWorkbook } from '../src/report/write-xlsx.js';
import type { StudentRecord } from '../src/domain/types.js';
import { makeStudent, SUBJECTS, uniform } from './helpers.js';

function model(students: StudentRecord[]) {
  return buildReportModel({
    current: { files: [], students, issues: [], duplicateIds: new Set(['0000123']), erroredIds: new Set() },
    previous: null,
    subjects: SUBJECTS,
  });
}

async function roundTrip(workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
  return reloaded;
}

describe('createScoreWorkbook', () => {
  const students = [
    uniform(90, { studentId: '0000123', className: '701', seat: '1', name: '王小明' }),
    makeStudent([85.5, 80, 'x', 80, 80, 80, 80, 80], { studentId: '0000456', className: '701', seat: '2', name: '李大華' }),
    uniform(70, { studentId: '0000789', className: '702', seat: '1', name: '陳怡君' }),
  ];

  it('工作表數量為班級數加 1（全年級）', async () => {
    const workbook = await roundTrip(createScoreWorkbook(model(students)));

    expect(workbook.worksheets.map((w) => w.name)).toEqual(['全年級', '701', '702']);
  });

  it('學號保留為文字、缺考顯示「缺考」、分數為數字，並附名次與 PR', async () => {
    const workbook = await roundTrip(createScoreWorkbook(model(students)));
    const sheet = workbook.getWorksheet('701');
    const header = (sheet?.getRow(1).values as unknown[]).slice(1);
    const row2 = (sheet?.getRow(2).values as unknown[]).slice(1);
    const row3 = (sheet?.getRow(3).values as unknown[]).slice(1);
    const col = (name: string): number => header.indexOf(name);

    expect(header).toEqual([
      '班級', '座號', '學號', '姓名', ...SUBJECTS, '總分', '平均', '缺考科目數', '全年級名次', 'PR', '備註',
    ]);
    expect(row2).toEqual(['701', '1', '0000123', '王小明', ...SUBJECTS.map(() => 90), 720, 90, 0, 1, 75, '學號重複']);
    expect(row3[col('國文')]).toBe(85.5);
    expect(row3[col('數學')]).toBe('缺考');
    expect(row3[col('缺考科目數')]).toBe(1);
    // 有缺考不排名：名次、PR 留白
    expect(row3[col('全年級名次')]).toBeUndefined();
    expect(row3[col('PR')]).toBeUndefined();
  });

  it('每個工作表下方附各科統計列', async () => {
    const workbook = await roundTrip(createScoreWorkbook(model(students)));
    const sheet = workbook.getWorksheet('全年級');
    const labels: unknown[] = [];
    sheet?.eachRow((row) => labels.push(row.getCell(4).value));

    expect(labels).toEqual(expect.arrayContaining(['應考人數', '實考人數', '平均', '標準差', '及格率']));
  });
});
