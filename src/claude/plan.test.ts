import { describe, expect, it } from 'vitest';

import { ChangeType } from '../changeType.ts';
import { sessionColorFor } from '../terminal/sessionColor.ts';
import { planLaunch, usesPassthroughFlag } from './plan.ts';
import { TargetKind } from './targetKind.ts';

const REPOSITORY_ROOT = '/repo';

const existingWorktree = {
  kind: TargetKind.Existing,
  path: '/repo-wt/api',
  branch: 'feat/api',
  hasStoredSession: false,
};

const newWorktree = { kind: TargetKind.New, name: 'feat/thing' } as const;

const plan = (
  target: Parameters<typeof planLaunch>[0]['target'] = existingWorktree,
  forwardedArgs: readonly string[] = [],
) => planLaunch({ repositoryRoot: REPOSITORY_ROOT, target, forwardedArgs });

describe('usesPassthroughFlag', () => {
  it('detects a bare flag', () => {
    expect(usesPassthroughFlag(['-c'])).toBe(true);
  });

  it('detects a flag written with an inline value', () => {
    expect(usesPassthroughFlag(['--from-pr=123'])).toBe(true);
  });

  it('ignores arguments that merely start with a flag name', () => {
    expect(usesPassthroughFlag(['--continuous'])).toBe(false);
  });

  it('ignores a prompt that happens to contain a flag name', () => {
    expect(usesPassthroughFlag(['fix the -c handling'])).toBe(false);
  });

  it('is false for an empty argv', () => {
    expect(usesPassthroughFlag([])).toBe(false);
  });
});

describe('planLaunch for an existing worktree', () => {
  it('runs claude in the worktree directory', () => {
    expect(plan().command).toBe('claude');
    expect(plan().cwd).toBe('/repo-wt/api');
  });

  it('starts with the base arguments', () => {
    expect(plan().args[0]).toBe('--dangerously-skip-permissions');
  });

  it('continues a session the worktree already has', () => {
    expect(plan({ ...existingWorktree, hasStoredSession: true }).args).toContain('--continue');
  });

  it('does not continue when the worktree has no stored session', () => {
    expect(plan().args).not.toContain('--continue');
  });

  it('names the session after the worktree directory', () => {
    expect(plan().args).toEqual(expect.arrayContaining(['--name', 'api']));
  });

  it('titles the terminal after the worktree and branch', () => {
    expect(plan().title).toBe('api · feat/api');
  });

  it('omits the branch from the title when the worktree is detached', () => {
    expect(plan({ ...existingWorktree, branch: undefined }).title).toBe('api');
  });

  it('puts forwarded arguments last so they win', () => {
    expect(plan(existingWorktree, ['--model', 'opus']).args.slice(-2)).toEqual(['--model', 'opus']);
  });
});

describe('planLaunch for a new worktree', () => {
  it('runs from the main checkout, where git can create the worktree', () => {
    expect(plan(newWorktree).cwd).toBe(REPOSITORY_ROOT);
  });

  it('asks claude for the worktree by name', () => {
    expect(plan(newWorktree).args).toEqual(expect.arrayContaining(['--worktree', 'feat/thing']));
  });

  it('never continues a session, because the worktree does not exist yet', () => {
    expect(plan(newWorktree).args).not.toContain('--continue');
  });

  it('titles the terminal after the requested name', () => {
    expect(plan(newWorktree).title).toBe('feat/thing');
  });
});

describe('planLaunch session colour', () => {
  it('colours a worktree after the kind of change it holds', () => {
    const target = { ...existingWorktree, path: '/repo-wt/feat+retry', branch: 'feat/retry' };

    expect(plan(target).color).toEqual(sessionColorFor('x', ChangeType.Feat));
  });

  it('reads the type off the branch when the directory name lost it', () => {
    const target = { ...existingWorktree, path: '/repo-wt/retry', branch: 'fix/retry' };

    expect(plan(target).color).toEqual(sessionColorFor('x', ChangeType.Fix));
  });

  it('gives a worktree that names no type a quieter colour of its own', () => {
    const target = { ...existingWorktree, path: '/repo-wt/spike', branch: 'spike' };

    expect(plan(target).color).toEqual(sessionColorFor('spike', undefined));
  });

  it('colours a new worktree after the type chosen for it', () => {
    expect(plan(newWorktree).color).toEqual(sessionColorFor('x', ChangeType.Feat));
  });
});
