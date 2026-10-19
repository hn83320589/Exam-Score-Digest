import type { Score } from '../domain/types.js';

export const ABSENT_LABEL = '缺考';
export const EMPTY = '—';

/** 850 → "85"、855 → "85.5" */
export function formatTenths(tenths: number): string {
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
}

export function formatScore(score: Score | undefined): string {
  return score?.kind === 'present' ? formatTenths(score.tenths) : ABSENT_LABEL;
}

export function formatFixed(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? EMPTY : value.toFixed(digits);
}

export function formatPercent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? EMPTY : `${(rate * 100).toFixed(1)}%`;
}

export function formatSigned(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}
