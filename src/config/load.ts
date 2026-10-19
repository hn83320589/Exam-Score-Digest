import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ConfigError, validateConfig, type DigestConfig } from './schema.js';

// src/config/load.ts 與 dist/config/load.js 都在專案根目錄下兩層
export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/subjects.json', import.meta.url));

export async function loadConfig(path: string = DEFAULT_CONFIG_PATH): Promise<DigestConfig> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new ConfigError(`無法讀取設定檔 ${path}：${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new ConfigError(`設定檔 ${path} 不是有效的 JSON：${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  try {
    return validateConfig(raw);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw new ConfigError(`${path}：${error.message}`);
    }
    throw error;
  }
}
