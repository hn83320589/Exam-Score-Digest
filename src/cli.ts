#!/usr/bin/env node
import { parseCliArgs, USAGE } from './cli-args.js';

const EXIT_USAGE = 2;

const result = parseCliArgs(process.argv.slice(2));
if (!result.ok) {
  console.error(`錯誤：${result.error}\n\n${USAGE}`);
  process.exit(EXIT_USAGE);
}

// 實際的 build pipeline 於後續里程碑串接
console.error(`exam-digest：尚未實作 build（輸入：${result.options.inputDir}）`);
process.exit(1);
