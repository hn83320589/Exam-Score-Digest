import type { DigestConfig, FieldAliases } from '../config/schema.js';
import { normalizeHeader } from './text.js';
import type { SubjectName } from './types.js';

export interface ColumnMap {
  className?: number;
  seat?: number;
  studentId: number;
  name: number;
  subjects: ReadonlyMap<SubjectName, number>;
}

export type HeaderMapResult =
  | { ok: true; columns: ColumnMap; unknown: string[] }
  | { ok: false; error: string };

type FieldKey = keyof FieldAliases;
type Target = { kind: 'field'; key: FieldKey; label: string } | { kind: 'subject'; name: SubjectName };

const FIELD_LABELS: Record<FieldKey, string> = {
  className: '班級',
  seat: '座號',
  studentId: '學號',
  name: '姓名',
};

function buildLookup(config: DigestConfig): Map<string, Target> {
  const lookup = new Map<string, Target>();
  for (const key of Object.keys(FIELD_LABELS) as FieldKey[]) {
    for (const alias of config.fields[key]) {
      lookup.set(normalizeHeader(alias), { kind: 'field', key, label: FIELD_LABELS[key] });
    }
  }
  for (const subject of config.subjects) {
    for (const alias of [subject.name, ...subject.aliases]) {
      lookup.set(normalizeHeader(alias), { kind: 'subject', name: subject.name });
    }
  }
  return lookup;
}

export function mapHeaders(headers: readonly string[], config: DigestConfig): HeaderMapResult {
  const lookup = buildLookup(config);
  const ignored = new Set(config.ignoreColumns.map(normalizeHeader));
  const fields = new Map<FieldKey, number>();
  const subjects = new Map<SubjectName, number>();
  const unknown: string[] = [];
  const conflicts: string[] = [];

  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key === '' || ignored.has(key)) return;

    const target = lookup.get(key);
    if (target === undefined) {
      unknown.push(header.trim());
    } else if (target.kind === 'field') {
      if (fields.has(target.key)) conflicts.push(target.label);
      fields.set(target.key, index);
    } else {
      if (subjects.has(target.name)) conflicts.push(target.name);
      subjects.set(target.name, index);
    }
  });

  if (conflicts.length > 0) {
    return { ok: false, error: `多個欄位對應到同一項目：${conflicts.join('、')}` };
  }

  const studentId = fields.get('studentId');
  const name = fields.get('name');
  const missing = [
    ...(studentId === undefined ? ['學號'] : []),
    ...(name === undefined ? ['姓名'] : []),
    ...config.subjects.filter((s) => !subjects.has(s.name)).map((s) => s.name),
  ];
  if (studentId === undefined || name === undefined || missing.length > 0) {
    return { ok: false, error: `缺少必要欄位：${missing.join('、')}` };
  }

  const className = fields.get('className');
  const seat = fields.get('seat');
  return {
    ok: true,
    columns: {
      ...(className !== undefined && { className }),
      ...(seat !== undefined && { seat }),
      studentId,
      name,
      subjects,
    },
    unknown,
  };
}
