import { describe, expect, it, vi } from 'vitest';

import { COMMIT_FIELD_SEPARATOR } from './porcelain.ts';
import { findEnclosingWorktree, openRepository } from './repository.ts';

const WORKTREE_LIST = [
  'worktree /repo\nHEAD aaa\nbranch refs/heads/main\n',
  'worktree /repo-wt/old\nHEAD bbb\nbranch refs/heads/feat/old\n',
  'worktree /repo-wt/new\nHEAD ccc\nbranch refs/heads/feat/new\n',
].join('\n');

const COMMITS = [
  ['aaa', '300', '1 hour ago'].join(COMMIT_FIELD_SEPARATOR),
  ['bbb', '100', '3 days ago'].join(COMMIT_FIELD_SEPARATOR),
  ['ccc', '200', '2 days ago'].join(COMMIT_FIELD_SEPARATOR),
].join('\n');

const fakeGit = (overrides: Record<string, string> = {}) =>
  vi.fn((args: string[]) => {
    const [command] = args;

    if (command === 'rev-parse') return overrides['rev-parse'] ?? '/repo/.git';
    if (command === 'worktree') return overrides['worktree'] ?? WORKTREE_LIST;
    if (command === 'show') return overrides['show'] ?? COMMITS;

    throw new Error(`unexpected git invocation: ${args.join(' ')}`);
  });

describe('openRepository', () => {
  it('derives the main checkout from the common git directory', () => {
    const repository = openRepository({ git: fakeGit(), cwd: '/repo' });

    expect(repository?.mainCheckout).toBe('/repo');
  });

  it('puts the main checkout first and orders the rest by most recent commit', () => {
    const repository = openRepository({ git: fakeGit(), cwd: '/repo' });

    expect(repository?.worktrees.map((worktree) => worktree.path)).toEqual([
      '/repo',
      '/repo-wt/new',
      '/repo-wt/old',
    ]);
  });

  it('marks exactly one worktree as the main checkout', () => {
    const repository = openRepository({ git: fakeGit(), cwd: '/repo' });

    expect(repository?.worktrees.filter((worktree) => worktree.isMainCheckout)).toHaveLength(1);
    expect(repository?.worktrees[0]?.isMainCheckout).toBe(true);
  });

  it('attaches the commit summary belonging to each worktree head', () => {
    const repository = openRepository({ git: fakeGit(), cwd: '/repo' });

    expect(repository?.worktrees[1]?.commit?.relative).toBe('2 days ago');
  });

  it('returns undefined when the directory is not inside a git repository', () => {
    const git = vi.fn(() => {
      throw new Error('fatal: not a git repository');
    });

    expect(openRepository({ git, cwd: '/tmp' })).toBeUndefined();
  });

  it('does not ask git for commit details when there are no revisions', () => {
    const git = fakeGit({ worktree: 'worktree /repo\nbare\n' });
    openRepository({ git, cwd: '/repo' });

    expect(git.mock.calls.flatMap(([args]) => args)).not.toContain('show');
  });

  it('tolerates a repository whose worktree list omits the main checkout', () => {
    const repository = openRepository({
      git: fakeGit({ worktree: 'worktree /repo-wt/new\nHEAD ccc\nbranch refs/heads/feat/new\n' }),
      cwd: '/repo',
    });

    expect(repository?.mainCheckout).toBe('/repo');
    expect(repository?.worktrees.map((worktree) => worktree.path)).toEqual(['/repo-wt/new']);
  });
});

describe('findEnclosingWorktree', () => {
  const worktrees = [{ path: '/repo' }, { path: '/repo/nested' }, { path: '/elsewhere' }];

  it('picks the deepest worktree that contains the directory', () => {
    expect(findEnclosingWorktree(worktrees, '/repo/nested/src')?.path).toBe('/repo/nested');
  });

  it('matches a worktree root exactly', () => {
    expect(findEnclosingWorktree(worktrees, '/repo')?.path).toBe('/repo');
  });

  it('does not match a sibling whose path shares a prefix', () => {
    expect(findEnclosingWorktree([{ path: '/repo' }], '/repo-other/src')).toBeUndefined();
  });

  it('returns undefined when nothing contains the directory', () => {
    expect(findEnclosingWorktree(worktrees, '/tmp')).toBeUndefined();
  });
});

describe('openRepository when commit details are unavailable', () => {
  it('still lists worktrees when git show fails', () => {
    const git = (args: string[]) => {
      if (args[0] === 'rev-parse') return '/repo/.git';
      if (args[0] === 'worktree') return WORKTREE_LIST;

      throw new Error('fatal: bad object');
    };

    const repository = openRepository({ git, cwd: '/repo' });

    expect(repository?.worktrees).toHaveLength(3);
    expect(repository?.worktrees.every((worktree) => worktree.commit === undefined)).toBe(true);
  });
});
