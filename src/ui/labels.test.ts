import { describe, expect, it } from 'vitest';

import { CHANGE_TYPES } from '../changeType.ts';
import type { Worktree } from '../git/repository.ts';
import { createPalette } from '../terminal/palette.ts';
import { sessionColorFor } from '../terminal/sessionColor.ts';
import {
  changeTypeCatalogue,
  worktreeNameRequirement,
  removalFailureNotice,
  removalQuestion,
  worktreeDetails,
  worktreeLabel,
} from './labels.ts';

const palette = createPalette({ supported: false });

const worktree = (overrides: Partial<Worktree> = {}): Worktree => ({
  path: '/repo-wt/api',
  head: 'abc',
  branch: 'feat/api',
  isBare: false,
  isMainCheckout: false,
  commit: { committedAt: 100, relative: '2 days ago' },
  ...overrides,
});

describe('worktreeDetails', () => {
  it('lists branch and commit age', () => {
    expect(worktreeDetails(worktree())).toEqual(['feat/api', '2 days ago']);
  });

  it('says detached when there is no branch', () => {
    expect(worktreeDetails(worktree({ branch: undefined }))).toEqual(['detached', '2 days ago']);
  });

  it('marks the main checkout', () => {
    expect(worktreeDetails(worktree({ isMainCheckout: true }))).toContain('main checkout');
  });

  it('omits commit age when the commit is unknown', () => {
    expect(worktreeDetails(worktree({ commit: undefined }))).toEqual(['feat/api']);
  });
});

describe('worktreeLabel', () => {
  it('leads with the worktree directory name', () => {
    expect(worktreeLabel(worktree(), palette).startsWith('api')).toBe(true);
  });

  it('appends the details after the name', () => {
    expect(worktreeLabel(worktree(), palette)).toBe('api  feat/api · 2 days ago');
  });

  it('leaves the name unpainted, so the list stays quiet', () => {
    const colored = createPalette({ supported: true });

    expect(worktreeLabel(worktree(), colored)).toContain('api');
    expect(worktreeLabel(worktree(), colored)).not.toContain(
      colored.session(sessionColorFor('api', undefined))('api'),
    );
  });

  it('still marks the main checkout', () => {
    const colored = createPalette({ supported: true });

    expect(worktreeLabel(worktree({ isMainCheckout: true }), colored)).toContain(colored.strong('api'));
  });
});

describe('removalQuestion', () => {
  const web = worktree({ path: '/repo-wt/web' });

  it('names the single worktree, and what survives it', () => {
    expect(removalQuestion([worktree()])).toBe('Remove api? Its directory goes, its branch stays.');
  });

  it('counts worktrees instead of naming them all', () => {
    expect(removalQuestion([worktree(), web])).toBe(
      'Remove 2 worktrees? Their directories go, their branches stay.',
    );
  });
});

describe('removalFailureNotice', () => {
  it('leads with the worktree name, then the words git used', () => {
    expect(removalFailureNotice({ path: '/repo-wt/api', reason: "fatal: '/repo-wt/api' is locked" })).toBe(
      "api: fatal: '/repo-wt/api' is locked",
    );
  });
});

describe('worktreeNameRequirement', () => {
  it('accepts a name that starts with a type', () => {
    expect(worktreeNameRequirement('feat/retry')).toBeUndefined();
  });

  it('accepts a name with no type at all, because a type is an offer, not a rule', () => {
    expect(worktreeNameRequirement('spike-the-parser')).toBeUndefined();
  });

  it('asks for something rather than nothing', () => {
    expect(worktreeNameRequirement('')).toBeDefined();
    expect(worktreeNameRequirement('   ')).toBeDefined();
    expect(worktreeNameRequirement(undefined)).toBeDefined();
  });
});

describe('changeTypeCatalogue', () => {
  it('lists every type on a line of its own', () => {
    const lines = changeTypeCatalogue(palette).split('\n');

    for (const [index, type] of CHANGE_TYPES.entries()) {
      expect(lines[index]).toContain(type);
    }
  });

  it('offers a line for a name that is none of them', () => {
    const lines = changeTypeCatalogue(palette).split('\n');

    expect(lines).toHaveLength(CHANGE_TYPES.length + 1);
    expect(lines.at(-1)).toContain('anything else');
  });
});
