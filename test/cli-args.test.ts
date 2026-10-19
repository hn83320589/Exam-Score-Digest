import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../src/cli-args.js';

describe('parseCliArgs', () => {
  it('解析 build 指令與所有參數', () => {
    const result = parseCliArgs([
      'build',
      'data/now',
      '--prev',
      'data/before',
      '--out',
      'reports',
      '--config',
      'my.json',
      '--public',
    ]);

    expect(result).toEqual({
      ok: true,
      options: {
        inputDir: 'data/now',
        prevDir: 'data/before',
        outDir: 'reports',
        configPath: 'my.json',
        isPublic: true,
      },
    });
  });

  it('未指定的選用參數使用預設值', () => {
    const result = parseCliArgs(['build', 'data/now']);

    expect(result).toEqual({
      ok: true,
      options: { inputDir: 'data/now', outDir: 'out', isPublic: false },
    });
  });

  it('未知的子指令回報錯誤', () => {
    const result = parseCliArgs(['make', 'data/now']);

    expect(result).toEqual({ ok: false, error: '未知的指令：make' });
  });

  it('缺少資料夾參數回報錯誤', () => {
    const result = parseCliArgs(['build']);

    expect(result).toEqual({ ok: false, error: '請指定成績檔資料夾' });
  });

  it('未知的選項回報錯誤而不是忽略', () => {
    const result = parseCliArgs(['build', 'data/now', '--bogus']);

    expect(result.ok).toBe(false);
  });
});
