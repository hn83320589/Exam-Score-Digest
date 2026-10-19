import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importFolder, listScoreFiles } from '../src/io/import-folder.js';
import { loadConfig } from '../src/config/load.js';

const HEADER = '班級,座號,學號,姓名,國文,英語,數學,自然,歷史,地理,公民,健康';

async function folderWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'exam-digest-'));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

describe('listScoreFiles', () => {
  it('只列出 csv/xlsx，排除 Excel 暫存檔與隱藏檔，並依檔名排序', async () => {
    const dir = await folderWith({
      '702.CSV': '',
      '701.xlsx': '',
      '~$701.xlsx': '',
      '.DS_Store': '',
      'readme.txt': '',
    });

    expect(await listScoreFiles(dir)).toEqual(['701.xlsx', '702.CSV']);
  });

  it('資料夾不存在時拋出含路徑的錯誤', async () => {
    await expect(listScoreFiles('/no/such/dir')).rejects.toThrow('/no/such/dir');
  });
});

describe('importFolder', () => {
  it('合併多個檔案、偵測跨檔重複學號、記錄因錯誤被跳過的學號', async () => {
    const dir = await folderWith({
      '701.csv': `${HEADER}\n701,1,1120001,王小明,80,80,80,80,80,80,80,80\n701,2,1120002,李大華,101,80,80,80,80,80,80,80\n`,
      '702.csv': `${HEADER}\n702,1,1120001,王小明,70,70,70,70,70,70,70,70\n`,
      '703.xlsx': 'not really an xlsx',
    });

    const result = await importFolder(dir, await loadConfig());

    expect(result.students.map((s) => s.studentId)).toEqual(['1120001']);
    expect(result.duplicateIds).toEqual(new Set(['1120001']));
    expect(result.erroredIds).toEqual(new Set(['1120001', '1120002']));
    expect(result.erroredSeats).toEqual(new Set(['701#2', '702#1']));
    expect(result.issues.map((i) => [i.kind, i.file])).toEqual([
      ['invalid-score', '701.csv'],
      ['duplicate-id', '702.csv'],
      ['file-error', '703.xlsx'],
    ]);
  });
});
