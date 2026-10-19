import { runBuild } from './build.js';
import { parseCliArgs, USAGE } from './cli-args.js';

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `\n  原因：${error.cause.message}` : '';
  return `${error.message}${cause}`;
}

export async function main(argv: readonly string[], log: (line: string) => void): Promise<number> {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    log(`錯誤：${parsed.error}\n\n${USAGE}`);
    return EXIT_USAGE;
  }

  const startedAt = performance.now();
  try {
    const result = await runBuild(parsed.options);
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(2);
    const previous = result.previousIssueCount === null ? '' : `（上次段考 ${result.previousIssueCount} 筆）`;
    log(`已匯入 ${result.classCount} 班、${result.studentCount} 人；匯入問題 ${result.issueCount} 筆${previous}，詳見報表「匯入問題清單」`);
    for (const path of result.outputs) log(`輸出：${path}`);
    log(`完成，耗時 ${seconds} 秒`);
    return EXIT_OK;
  } catch (error) {
    log(`錯誤：${describeError(error)}`);
    return EXIT_FAILURE;
  }
}
