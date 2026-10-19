import { parseArgs } from 'node:util';

export interface BuildOptions {
  inputDir: string;
  prevDir?: string;
  outDir: string;
  configPath?: string;
  isPublic: boolean;
}

export type CliArgsResult =
  | { ok: true; options: BuildOptions }
  | { ok: false; error: string };

export const USAGE = `用法：
  exam-digest build <資料夾> [--prev <上次資料夾>] [--out <輸出資料夾>] [--config <設定檔>] [--public]

選項：
  --prev <資料夾>   上一次段考的成績檔資料夾，用於進步／退步比較
  --out <資料夾>    輸出資料夾（預設：out）
  --config <檔案>   科目對應設定檔（預設：內建 config/subjects.json）
  --public          只輸出可公告的公開版報表（不含姓名、學號與個人分數）`;

export function parseCliArgs(argv: readonly string[]): CliArgsResult {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        prev: { type: 'string' },
        out: { type: 'string', default: 'out' },
        config: { type: 'string' },
        public: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const [command, inputDir] = parsed.positionals;
  if (command !== 'build') {
    return { ok: false, error: command === undefined ? '請指定指令' : `未知的指令：${command}` };
  }
  if (inputDir === undefined) {
    return { ok: false, error: '請指定成績檔資料夾' };
  }

  const { prev, out, config } = parsed.values;
  return {
    ok: true,
    options: {
      inputDir,
      ...(prev !== undefined && { prevDir: prev }),
      outDir: out,
      ...(config !== undefined && { configPath: config }),
      isPublic: parsed.values.public,
    },
  };
}
