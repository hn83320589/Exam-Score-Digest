import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { runBuild } from '../src/build.js';

const HEADER = ['班級', '座號', '學號', '姓名', '國文', '英語', '數學', '自然', '歷史', '地理', '公民', '健康'];
const CLASSES = 15;
const STUDENTS = 35;

function rows(classIndex: number): (string | number)[][] {
  const className = String(701 + classIndex);
  return Array.from({ length: STUDENTS }, (_, i) => [
    className,
    i + 1,
    `11${String(classIndex).padStart(3, '0')}${String(i + 1).padStart(2, '0')}`,
    `測試生${classIndex}${i}`,
    ...Array.from({ length: 8 }, (_, s) => (classIndex * 7 + i * 13 + s * 17) % 101),
  ]);
}

/** 資料量上限：15 班 × 35 人 × 8 科，一半 CSV、一半 xlsx。 */
async function largeFolder(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'exam-digest-perf-'));
  for (let c = 0; c < CLASSES; c++) {
    const file = join(dir, String(701 + c));
    if (c % 2 === 0) {
      await writeFile(`${file}.csv`, [HEADER, ...rows(c)].map((r) => r.join(',')).join('\r\n'));
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('成績');
      sheet.addRows([HEADER, ...rows(c)]);
      await workbook.xlsx.writeFile(`${file}.xlsx`);
    }
  }
  return dir;
}

describe('效能', () => {
  it('15 班 × 35 人 × 8 科（含比較），從匯入到輸出報表在 10 秒內完成', async () => {
    const current = await largeFolder();
    const previous = await largeFolder();
    const outDir = await mkdtemp(join(tmpdir(), 'exam-digest-perf-out-'));

    const startedAt = performance.now();
    const result = await runBuild({ inputDir: current, prevDir: previous, outDir, isPublic: false });
    const elapsed = performance.now() - startedAt;

    expect(result.studentCount).toBe(CLASSES * STUDENTS);
    expect(elapsed).toBeLessThan(10_000);
  });
});
