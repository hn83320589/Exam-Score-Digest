import { describe, expect, it } from 'vitest';
import { ConfigError, validateConfig } from '../src/config/schema.js';
import { loadConfig } from '../src/config/load.js';

const EIGHT_SUBJECTS = ['國文', '英語', '數學', '自然', '歷史', '地理', '公民', '健康'].map((name) => ({
  name,
  aliases: [],
}));

describe('validateConfig', () => {
  it('只給 subjects 時其餘欄位使用預設值', () => {
    const config = validateConfig({ subjects: EIGHT_SUBJECTS });

    expect(config.subjects).toHaveLength(8);
    expect(config.fields.studentId).toContain('學號');
    expect(config.absentTokens).toEqual(['缺', '缺考']);
  });

  it('科目數不是 8 個時拒絕', () => {
    expect(() => validateConfig({ subjects: EIGHT_SUBJECTS.slice(0, 7) })).toThrow(ConfigError);
  });

  it('別名與其他科目名稱衝突時拒絕', () => {
    const subjects = EIGHT_SUBJECTS.map((s) => (s.name === '英語' ? { name: '英語', aliases: ['國文'] } : s));

    expect(() => validateConfig({ subjects })).toThrow(/重複/);
  });

  it('格式錯誤時錯誤訊息指出欄位', () => {
    expect(() => validateConfig({ subjects: 'oops' })).toThrow(/subjects/);
  });
});

describe('loadConfig', () => {
  it('未指定路徑時載入內建設定檔', async () => {
    const config = await loadConfig();

    expect(config.subjects.map((s) => s.name)).toContain('國文');
  });

  it('設定檔不存在時拋出含路徑的錯誤', async () => {
    await expect(loadConfig('no/such/file.json')).rejects.toThrow(/no\/such\/file\.json/);
  });
});
