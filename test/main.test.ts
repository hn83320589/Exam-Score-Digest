import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../src/main.js';
import { SAMPLE_DIR } from './sample-model.js';

function capture(): { lines: string[]; write: (line: string) => void } {
  const lines: string[] = [];
  return { lines, write: (line) => lines.push(line) };
}

describe('main', () => {
  it('成功時回傳 0，並印出匯入摘要與輸出路徑', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'exam-digest-cli-'));
    const io = capture();

    const code = await main(
      ['build', join(SAMPLE_DIR, 'current'), '--prev', join(SAMPLE_DIR, 'previous'), '--out', outDir],
      io.write,
    );

    expect(code).toBe(0);
    expect((await readdir(outDir)).sort()).toEqual(['exam-report.html', 'exam-scores.xlsx']);
    const output = io.lines.join('\n');
    expect(output).toContain('12 班、355 人');
    expect(output).toContain('匯入問題 6 筆');
    expect(output).toContain(join(outDir, 'exam-report.html'));
  });

  it('參數錯誤時回傳 2 並印出用法', async () => {
    const io = capture();

    expect(await main(['build'], io.write)).toBe(2);
    expect(io.lines.join('\n')).toContain('用法');
  });

  it('執行錯誤時回傳 1 並印出原因，不吞掉錯誤', async () => {
    const io = capture();

    expect(await main(['build', '/no/such/dir'], io.write)).toBe(1);
    expect(io.lines.join('\n')).toContain('/no/such/dir');
  });
});
