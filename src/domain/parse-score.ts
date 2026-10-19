import { normalizeCell } from './text.js';
import type { ParsedScore } from './types.js';

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

export function parseScore(raw: string, absentTokens: readonly string[]): ParsedScore {
  const value = normalizeCell(raw);
  if (value === '' || absentTokens.includes(value)) {
    return { kind: 'absent' };
  }

  const match = NUMBER_PATTERN.exec(value);
  if (match === null) {
    return { kind: 'invalid', reason: `分數 "${raw}" 無法解析` };
  }

  const decimals = match[1];
  if (decimals !== undefined && decimals.length > 2) {
    return { kind: 'invalid', reason: `分數 "${raw}" 最多只能有一位小數` };
  }

  const tenths = Math.round(Number(value) * 10);
  if (tenths < 0 || tenths > 1000) {
    return { kind: 'invalid', reason: `分數 "${raw}" 超出範圍 0–100` };
  }
  return { kind: 'present', tenths };
}
