import { describe, expect, it, vi } from 'vitest';

import { COMMIT_FIELD_SEPARATOR } from './porcelain.ts';
import { findEnclosingWorktree, openRepository, removableWorktrees } from './repository.ts';

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

    expect(repository?.directory).toBe('/repo');
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

    expect(repository?.directory).toBe('/repo');
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

const gitWithoutCommitDetails = (args: string[]) => {
  if (args[0] === 'rev-parse') return '/repo/.git';
  if (args[0] === 'worktree') return WORKTREE_LIST;

  throw new Error('fatal: bad object');
};

describe('openRepository when commit details are unavailable', () => {
  it('still lists worktrees when git show fails', () => {
    const repository = openRepository({ git: gitWithoutCommitDetails, cwd: '/repo' });

    expect(repository?.worktrees).toHaveLength(3);
    expect(repository?.worktrees.every((worktree) => worktree.commit === undefined)).toBe(true);
  });
});

describe('openRepository with a bare repository layout', () => {
  const BARE_LIST = [
    'worktree /proj/.bare\nbare\n',
    'worktree /proj/feat-x\nHEAD bbb\nbranch refs/heads/feat-x\n',
    'worktree /proj/main\nHEAD aaa\nbranch refs/heads/main\n',
  ].join('\n');

  const bareGit = (args: string[]) => {
    if (args[0] === 'rev-parse') return '/proj/.bare';
    if (args[0] === 'worktree') return BARE_LIST;
    if (args[0] === 'show')
      return [`aaa${COMMIT_FIELD_SEPARATOR}300${COMMIT_FIELD_SEPARATOR}1 hour ago`].join('\n');

    throw new Error(`unexpected git invocation: ${args.join(' ')}`);
  };

  it('does not offer the bare repository as a place to run', () => {
    const repository = openRepository({ git: bareGit, cwd: '/proj/main' });

    expect(repository?.worktrees.map((worktree) => worktree.path)).not.toContain('/proj/.bare');
  });

  it('has no primary worktree, because a bare layout has none', () => {
    const repository = openRepository({ git: bareGit, cwd: '/proj/main' });

    expect(repository?.worktrees.some((worktree) => worktree.isMainCheckout)).toBe(false);
  });

  it('names the repository after the directory holding the bare repository', () => {
    expect(openRepository({ git: bareGit, cwd: '/proj/main' })?.directory).toBe('/proj');
  });

  it('falls back to a real worktree as the place to create new worktrees from', () => {
    const repository = openRepository({ git: bareGit, cwd: '/proj/main' });

    expect(repository?.root).toBe(repository?.worktrees[0]?.path);
    expect(repository?.root).not.toBe('/proj/.bare');
  });
});

describe('openRepository with a standard layout', () => {
  it('uses the primary worktree as the root', () => {
    const repository = openRepository({ git: fakeGit(), cwd: '/repo' });

    expect(repository?.root).toBe('/repo');
    expect(repository?.directory).toBe('/repo');
  });
});

describe('removableWorktrees', () => {
  const worktrees = [
    { path: '/repo', isMainCheckout: true },
    { path: '/repo-wt/api', isMainCheckout: false },
    { path: '/repo-wt/web', isMainCheckout: false },
  ];

  it('never offers the main checkout, which git refuses to remove', () => {
    expect(removableWorktrees(worktrees, '/elsewhere').map((worktree) => worktree.path)).toEqual([
      '/repo-wt/api',
      '/repo-wt/web',
    ]);
  });

  it('never offers the worktree the user is standing in', () => {
    expect(removableWorktrees(worktrees, '/repo-wt/api/src').map((worktree) => worktree.path)).toEqual([
      '/repo-wt/web',
    ]);
  });

  it('offers nothing when the repository has only a main checkout', () => {
    expect(removableWorktrees([{ path: '/repo', isMainCheckout: true }], '/repo')).toEqual([]);
  });

  it('offers every worktree of a bare layout except the one in use', () => {
    const bare = [
      { path: '/proj/main', isMainCheckout: false },
      { path: '/proj/feat-x', isMainCheckout: false },
    ];

    expect(removableWorktrees(bare, '/proj/main').map((worktree) => worktree.path)).toEqual(['/proj/feat-x']);
  });
});
