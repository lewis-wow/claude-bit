export const ChangeType = {
  Feat: 'feat',
  Fix: 'fix',
  Refactor: 'refactor',
  Test: 'test',
  Docs: 'docs',
  Chore: 'chore',
  Perf: 'perf',
  Ci: 'ci',
} as const;

export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

export const CHANGE_TYPES: readonly ChangeType[] = Object.values(ChangeType);

const TYPE_PREFIX = /^([a-z]+)(?:[/+\-_.]|$)/u;
const isChangeType = (value: string): value is ChangeType =>
  (CHANGE_TYPES as readonly string[]).includes(value);

export const changeTypeOf = (name: string | undefined): ChangeType | undefined => {
  const prefix = TYPE_PREFIX.exec((name ?? '').trim().toLowerCase())?.[1];

  return prefix !== undefined && isChangeType(prefix) ? prefix : undefined;
};
