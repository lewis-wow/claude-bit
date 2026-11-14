import { describe, expect, it } from 'vitest';

import { CHANGE_TYPES, ChangeType, changeTypeOf } from './changeType.ts';

describe('changeTypeOf', () => {
  it('reads the type off a branch name', () => {
    expect(changeTypeOf('feat/retry-logic')).toBe(ChangeType.Feat);
  });

  it('reads the type off a directory name, however the slash survived', () => {
    expect(changeTypeOf('fix+crash')).toBe(ChangeType.Fix);
    expect(changeTypeOf('fix-crash')).toBe(ChangeType.Fix);
    expect(changeTypeOf('fix_crash')).toBe(ChangeType.Fix);
    expect(changeTypeOf('fix.crash')).toBe(ChangeType.Fix);
  });

  it('accepts a bare type with nothing after it', () => {
    expect(changeTypeOf('docs')).toBe(ChangeType.Docs);
  });

  it('ignores case, because branch names are typed by hand', () => {
    expect(changeTypeOf('FEAT/Retry')).toBe(ChangeType.Feat);
  });

  it('has no answer for a name that names no type', () => {
    expect(changeTypeOf('main')).toBeUndefined();
    expect(changeTypeOf('repo-alpha')).toBeUndefined();
    expect(changeTypeOf('features/retry')).toBeUndefined();
    expect(changeTypeOf('')).toBeUndefined();
    expect(changeTypeOf(undefined)).toBeUndefined();
  });

  it('recognises every type it offers', () => {
    for (const type of CHANGE_TYPES) {
      expect(changeTypeOf(`${type}/something`)).toBe(type);
    }
  });
});
