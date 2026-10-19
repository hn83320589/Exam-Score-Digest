import { normalizeCell, normalizeHeader } from '../domain/text.js';

export const SUBJECT_COUNT = 8;

export interface SubjectDefinition {
  name: string;
  aliases: string[];
}

export interface FieldAliases {
  className: string[];
  seat: string[];
  studentId: string[];
  name: string[];
}

export interface DigestConfig {
  subjects: SubjectDefinition[];
  fields: FieldAliases;
  ignoreColumns: string[];
  absentTokens: string[];
}

const DEFAULT_FIELDS: FieldAliases = {
  className: ['班級', '班別'],
  seat: ['座號'],
  studentId: ['學號'],
  name: ['姓名', '學生姓名'],
};
const DEFAULT_IGNORE = ['總分', '平均', '名次', '備註'];
const DEFAULT_ABSENT = ['缺', '缺考'];

export class ConfigError extends Error {
  override name = 'ConfigError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) {
    throw new ConfigError(`設定檔欄位 ${path} 必須是字串陣列`);
  }
  return value;
}

function optionalStringArray(value: unknown, path: string, fallback: string[]): string[] {
  return value === undefined ? fallback : stringArray(value, path);
}

function parseSubjects(value: unknown): SubjectDefinition[] {
  if (!Array.isArray(value)) {
    throw new ConfigError('設定檔欄位 subjects 必須是陣列');
  }
  return value.map((item: unknown, i) => {
    if (!isRecord(item) || typeof item.name !== 'string' || item.name.trim() === '') {
      throw new ConfigError(`設定檔欄位 subjects[${i}].name 必須是非空字串`);
    }
    return {
      name: item.name.trim(),
      aliases: optionalStringArray(item.aliases, `subjects[${i}].aliases`, []),
    };
  });
}

function parseFields(value: unknown): FieldAliases {
  if (value === undefined) return DEFAULT_FIELDS;
  if (!isRecord(value)) {
    throw new ConfigError('設定檔欄位 fields 必須是物件');
  }
  return {
    className: optionalStringArray(value.className, 'fields.className', DEFAULT_FIELDS.className),
    seat: optionalStringArray(value.seat, 'fields.seat', DEFAULT_FIELDS.seat),
    studentId: optionalStringArray(value.studentId, 'fields.studentId', DEFAULT_FIELDS.studentId),
    name: optionalStringArray(value.name, 'fields.name', DEFAULT_FIELDS.name),
  };
}

function assertUniqueHeaders(config: DigestConfig): void {
  const seen = new Map<string, string>();
  const claim = (header: string, owner: string): void => {
    const key = normalizeHeader(header);
    const previous = seen.get(key);
    if (previous !== undefined && previous !== owner) {
      throw new ConfigError(`欄名「${header}」重複出現在「${previous}」與「${owner}」`);
    }
    seen.set(key, owner);
  };

  for (const subject of config.subjects) {
    for (const header of [subject.name, ...subject.aliases]) claim(header, subject.name);
  }
  for (const field of Object.keys(config.fields) as (keyof FieldAliases)[]) {
    for (const header of config.fields[field]) claim(header, field);
  }
}

export function validateConfig(raw: unknown): DigestConfig {
  if (!isRecord(raw)) {
    throw new ConfigError('設定檔內容必須是 JSON 物件');
  }
  const subjects = parseSubjects(raw.subjects);
  if (subjects.length !== SUBJECT_COUNT) {
    throw new ConfigError(`設定檔 subjects 必須剛好 ${SUBJECT_COUNT} 科，目前為 ${subjects.length} 科`);
  }

  const config: DigestConfig = {
    subjects,
    fields: parseFields(raw.fields),
    ignoreColumns: optionalStringArray(raw.ignoreColumns, 'ignoreColumns', DEFAULT_IGNORE),
    absentTokens: optionalStringArray(raw.absentTokens, 'absentTokens', DEFAULT_ABSENT).map(normalizeCell),
  };
  assertUniqueHeaders(config);
  return config;
}
