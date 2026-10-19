import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SOURCE_DIRS = ['src', 'config', 'scripts'];

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

describe('原始碼不含任何網址', () => {
  it('src、config、scripts 中搜尋不到 http:// 或 https://', async () => {
    const files = (await Promise.all(SOURCE_DIRS.map((d) => listFiles(join(ROOT, d))))).flat();
    const offenders: string[] = [];
    for (const file of files) {
      if (/https?:\/\//i.test(await readFile(file, 'utf8'))) offenders.push(file);
    }

    expect(files.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
