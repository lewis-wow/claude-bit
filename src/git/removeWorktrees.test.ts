import { describe, expect, it, vi } from 'vitest';

import { removeWorktrees } from './removeWorktrees.ts';

const FATAL = "fatal: '/repo-wt/api' contains modified or untracked files, use --force to delete it";

const REFUSED = ['Command failed: git worktree remove /repo-wt/api', FATAL, ''].join('\n');

describe('removeWorktrees', () => {
  it('asks git to remove each worktree, from the repository the user is in', () => {
    const git = vi.fn(() => '');

    expect(removeWorktrees({ git, cwd: '/repo', paths: ['/repo-wt/api', '/repo-wt/web'] })).toEqual([]);
    expect(git.mock.calls).toEqual([
      [['worktree', 'remove', '/repo-wt/api'], { cwd: '/repo' }],
      [['worktree', 'remove', '/repo-wt/web'], { cwd: '/repo' }],
    ]);
  });

  it('reports the reason git refused, without stopping at the first refusal', () => {
    const git = vi
      .fn(() => '')
      .mockImplementationOnce(() => {
        throw new Error(REFUSED);
      });

    expect(removeWorktrees({ git, cwd: '/repo', paths: ['/repo-wt/api', '/repo-wt/web'] })).toEqual([
      { path: '/repo-wt/api', reason: FATAL },
    ]);
    expect(git).toHaveBeenCalledTimes(2);
  });

  it('quotes the line git called fatal, not a hint printed after it', () => {
    const git = vi
      .fn(() => '')
      .mockImplementationOnce(() => {
        throw new Error([REFUSED, 'hint: see git-worktree(1)'].join('\n'));
      });

    expect(removeWorktrees({ git, cwd: '/repo', paths: ['/repo-wt/api'] })).toEqual([
      { path: '/repo-wt/api', reason: REFUSED.split('\n').at(-2) },
    ]);
  });

  it('falls back to a plain reason when the failure says nothing', () => {
    const git = vi.fn(() => {
      throw new Error('');
    });

    expect(removeWorktrees({ git, cwd: '/repo', paths: ['/repo-wt/api'] })).toEqual([
      { path: '/repo-wt/api', reason: 'git refused to remove the worktree' },
    ]);
  });
});
