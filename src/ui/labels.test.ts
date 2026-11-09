import { describe, expect, it } from 'vitest';

import type { Worktree } from '../git/repository.ts';
import { createPalette } from '../terminal/palette.ts';
import { removalFailureNotice, removalQuestion, worktreeDetails, worktreeLabel } from './labels.ts';

const palette = createPalette('never');

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
});

describe('removalQuestion', () => {
  const web = worktree({ path: '/repo-wt/web' });

  it('names the single worktree, and what survives it', () => {
    expect(removalQuestion([worktree()], false)).toBe('Remove api? Its directory goes, its branch stays.');
  });

  it('counts worktrees instead of naming them all', () => {
    expect(removalQuestion([worktree(), web], false)).toBe(
      'Remove 2 worktrees? Their directories go, their branches stay.',
    );
  });

  it('says what a forced removal also destroys', () => {
    expect(removalQuestion([worktree()], true)).toBe(
      'Remove api? Its directory and any uncommitted changes go, its branch stays.',
    );
    expect(removalQuestion([worktree(), web], true)).toBe(
      'Remove 2 worktrees? Their directories and any uncommitted changes go, their branches stay.',
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
