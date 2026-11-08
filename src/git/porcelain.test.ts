import { describe, expect, it } from 'vitest';

import { COMMIT_FIELD_SEPARATOR, parseCommitSummaries, parseWorktreeList } from './porcelain.ts';

const commitLine = (...fields: string[]) => fields.join(COMMIT_FIELD_SEPARATOR);

describe('parseWorktreeList', () => {
  it('reads path, head and branch from each porcelain block', () => {
    const output = [
      'worktree /repo\nHEAD abc123\nbranch refs/heads/main\n',
      'worktree /repo-wt/feature\nHEAD def456\nbranch refs/heads/feat/thing\n',
    ].join('\n');

    expect(parseWorktreeList(output)).toEqual([
      { path: '/repo', head: 'abc123', branch: 'main' },
      { path: '/repo-wt/feature', head: 'def456', branch: 'feat/thing' },
    ]);
  });

  it('leaves branch undefined for a detached worktree', () => {
    const output = 'worktree /repo-wt/spike\nHEAD abc123\ndetached\n';

    expect(parseWorktreeList(output)).toEqual([
      { path: '/repo-wt/spike', head: 'abc123', branch: undefined },
    ]);
  });

  it('keeps paths that contain spaces intact', () => {
    const output = 'worktree /repo/My Project\nHEAD abc123\nbranch refs/heads/main\n';

    expect(parseWorktreeList(output)[0]?.path).toBe('/repo/My Project');
  });

  it('skips blocks without a worktree field', () => {
    expect(parseWorktreeList('\n\nHEAD abc123\n\n')).toEqual([]);
  });

  it('returns an empty list for empty output', () => {
    expect(parseWorktreeList('')).toEqual([]);
  });
});

describe('parseCommitSummaries', () => {
  it('indexes commit metadata by revision', () => {
    const output = [
      commitLine('abc123', '1700000000', '2 days ago'),
      commitLine('def456', '1700000100', '10 minutes ago'),
    ].join('\n');

    expect(parseCommitSummaries(output)).toEqual(
      new Map([
        ['abc123', { committedAt: 1_700_000_000, relative: '2 days ago' }],
        ['def456', { committedAt: 1_700_000_100, relative: '10 minutes ago' }],
      ]),
    );
  });

  it('ignores lines that are not shaped like a commit summary', () => {
    expect(parseCommitSummaries('\ngarbage\n')).toEqual(new Map());
  });
});

describe('parseWorktreeList with an unborn branch', () => {
  it('treats the null object id as no commit at all', () => {
    const output = `worktree /repo\nHEAD ${'0'.repeat(40)}\nbranch refs/heads/main\n`;

    expect(parseWorktreeList(output)).toEqual([{ path: '/repo', head: '', branch: 'main' }]);
  });
});
