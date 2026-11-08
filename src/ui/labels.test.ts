import { describe, expect, it } from 'vitest';

import type { Worktree } from '../git/repository.ts';
import { createPalette } from '../terminal/palette.ts';
import { worktreeDetails, worktreeLabel } from './labels.ts';

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
