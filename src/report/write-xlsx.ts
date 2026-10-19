import ExcelJS from 'exceljs';
import type { SubjectStats } from '../stats/subject-stats.js';
import { ABSENT_LABEL } from './format.js';
import type { ReportModel, StudentRow } from './model.js';

export const GRADE_SHEET_NAME = '全年級';

const META_HEADERS = ['班級', '座號', '學號', '姓名'];
const TRAILING_HEADERS = ['總分', '平均', '缺考科目數', '全年級名次', 'PR', '備註'];

function studentCells(row: StudentRow, subjects: readonly string[]): ExcelJS.CellValue[] {
  const { student } = row;
  return [
    student.className,
    student.seat,
    student.studentId,
    student.name,
    ...subjects.map((subject) => {
      const score = student.scores.get(subject);
      return score?.kind === 'present' ? score.tenths / 10 : ABSENT_LABEL;
    }),
    row.totalTenths / 10,
    row.average,
    row.absentCount,
    row.rank?.rank ?? null,
    row.rank?.pr ?? null,
    row.isDuplicateId ? '學號重複' : null,
  ];
}

function statRows(stats: readonly SubjectStats[]): [string, ExcelJS.CellValue[]][] {
  return [
    ['應考人數', stats.map((s) => s.enrolled)],
    ['實考人數', stats.map((s) => s.taken)],
    ['平均', stats.map((s) => s.stats?.mean ?? null)],
    ['中位數', stats.map((s) => s.stats?.median ?? null)],
    ['標準差', stats.map((s) => s.stats?.sd ?? null)],
    ['最高分', stats.map((s) => s.stats?.max ?? null)],
    ['最低分', stats.map((s) => s.stats?.min ?? null)],
    ['及格率', stats.map((s) => s.stats?.passRate ?? null)],
  ];
}

function fillSheet(
  sheet: ExcelJS.Worksheet,
  rows: readonly StudentRow[],
  stats: readonly SubjectStats[],
  subjects: readonly string[],
): void {
  const headers = [...META_HEADERS, ...subjects, ...TRAILING_HEADERS];
  sheet.addRow(headers).font = { bold: true };
  for (const row of rows) sheet.addRow(studentCells(row, subjects));

  const firstSubjectCol = META_HEADERS.length + 1;
  const averageCol = firstSubjectCol + subjects.length + 1;
  sheet.getColumn(3).numFmt = '@';
  sheet.getColumn(averageCol).numFmt = '0.00';

  sheet.addRow([]);
  for (const [label, values] of statRows(stats)) {
    const excelRow = sheet.addRow([null, null, null, label, ...values]);
    excelRow.font = { italic: true };
    for (let i = 0; i < subjects.length; i++) {
      excelRow.getCell(firstSubjectCol + i).numFmt = label === '及格率' ? '0.0%' : label.includes('人數') ? '0' : '0.00';
    }
  }

  sheet.views = [{ state: 'frozen', xSplit: META_HEADERS.length, ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: headers.length } };
  headers.forEach((header, i) => {
    sheet.getColumn(i + 1).width = header === '姓名' || header === '學號' ? 12 : Math.max(8, header.length * 2 + 2);
  });
}

/** Excel 工作表名稱不可含 []:*?/\ 且最多 31 字。 */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, '_').slice(0, 31);
}

export function createScoreWorkbook(model: ReportModel): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'exam-score-digest';

  const allRows = model.classes.flatMap((k) => k.students);
  fillSheet(workbook.addWorksheet(GRADE_SHEET_NAME), allRows, model.grade, model.subjects);
  for (const classReport of model.classes) {
    fillSheet(
      workbook.addWorksheet(sheetName(classReport.className)),
      classReport.students,
      classReport.subjects,
      model.subjects,
    );
  }
  return workbook;
}

export async function writeScoreWorkbook(model: ReportModel, path: string): Promise<void> {
  await createScoreWorkbook(model).xlsx.writeFile(path);
}
