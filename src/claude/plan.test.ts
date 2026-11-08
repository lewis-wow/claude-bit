import { describe, expect, it } from 'vitest';

import { defaultConfig } from '../config/schema.ts';
import type { Config } from '../config/schema.ts';
import { planLaunch, usesPassthroughFlag } from './plan.ts';
import { TargetKind } from './target-kind.ts';

const config = (overrides: Partial<Config> = {}): Config => ({ ...defaultConfig(), ...overrides });

const REPOSITORY = { root: '/repo', directory: '/repo' };

const existingWorktree = {
  kind: TargetKind.Existing,
  path: '/repo-wt/api',
  branch: 'feat/api',
  hasStoredSession: false,
};

describe('usesPassthroughFlag', () => {
  const flags = ['-c', '--continue', '--from-pr'];

  it('detects a bare flag', () => {
    expect(usesPassthroughFlag(['-c'], flags)).toBe(true);
  });

  it('detects a flag written with an inline value', () => {
    expect(usesPassthroughFlag(['--from-pr=123'], flags)).toBe(true);
  });

  it('ignores arguments that merely start with a flag name', () => {
    expect(usesPassthroughFlag(['--continuous'], flags)).toBe(false);
  });

  it('ignores a prompt that happens to contain a flag name', () => {
    expect(usesPassthroughFlag(['fix the -c handling'], flags)).toBe(false);
  });

  it('is false for an empty argv', () => {
    expect(usesPassthroughFlag([], flags)).toBe(false);
  });
});

describe('planLaunch for an existing worktree', () => {
  const plan = (overrides: Parameters<typeof planLaunch>[0]['target'] = existingWorktree) =>
    planLaunch({ config: config(), repository: REPOSITORY, target: overrides, forwardedArgs: [] });

  it('runs in the worktree directory', () => {
    expect(plan().cwd).toBe('/repo-wt/api');
  });

  it('starts with the configured base arguments', () => {
    expect(plan().args[0]).toBe('--dangerously-skip-permissions');
  });

  it('continues a session the worktree already has', () => {
    expect(plan({ ...existingWorktree, hasStoredSession: true }).args).toContain('--continue');
  });

  it('does not continue when the worktree has no stored session', () => {
    expect(plan().args).not.toContain('--continue');
  });

  it('does not continue when resuming is turned off', () => {
    const launch = planLaunch({
      config: config({ resumeExistingSession: false }),
      repository: REPOSITORY,
      target: { ...existingWorktree, hasStoredSession: true },
      forwardedArgs: [],
    });

    expect(launch.args).not.toContain('--continue');
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
    const launch = planLaunch({
      config: config(),
      repository: REPOSITORY,
      target: existingWorktree,
      forwardedArgs: ['--model', 'opus'],
    });

    expect(launch.args.slice(-2)).toEqual(['--model', 'opus']);
  });
});

describe('planLaunch for a new worktree', () => {
  const target = { kind: TargetKind.New, name: 'feat/thing' };

  const plan = (overrides: Partial<Config> = {}) =>
    planLaunch({ config: config(overrides), repository: REPOSITORY, target, forwardedArgs: [] });

  it('runs from the main checkout, where git can create the worktree', () => {
    expect(plan().cwd).toBe('/repo');
  });

  it('asks claude to create the worktree', () => {
    expect(plan().args).toEqual(expect.arrayContaining(['--worktree', 'feat/thing']));
  });

  it('never continues a session, because the worktree does not exist yet', () => {
    expect(plan().args).not.toContain('--continue');
  });

  it('appends the configured worktree-only arguments', () => {
    const launch = plan({ worktree: { namePlaceholder: 'x', args: ['--tmux'] } });

    expect(launch.args).toContain('--tmux');
  });

  it('titles the terminal after the requested name', () => {
    expect(plan().title).toBe('feat/thing');
  });
});

describe('planLaunch template configuration', () => {
  it('omits --name when the session name template is null', () => {
    const launch = planLaunch({
      config: config({ terminal: { title: '{worktree}', sessionName: null } }),
      repository: REPOSITORY,
      target: existingWorktree,
      forwardedArgs: [],
    });

    expect(launch.args).not.toContain('--name');
  });

  it('leaves the title unset when the title template is null', () => {
    const launch = planLaunch({
      config: config({ terminal: { title: null, sessionName: '{worktree}' } }),
      repository: REPOSITORY,
      target: existingWorktree,
      forwardedArgs: [],
    });

    expect(launch.title).toBeUndefined();
  });

  it('supports the repo and path tokens', () => {
    const launch = planLaunch({
      config: config({ terminal: { title: '{repo}: {worktree} ({path})', sessionName: null } }),
      repository: REPOSITORY,
      target: existingWorktree,
      forwardedArgs: [],
    });

    expect(launch.title).toBe('repo: api (/repo-wt/api)');
  });

  it('uses the configured command', () => {
    expect(
      planLaunch({
        config: config({ command: 'claude-next' }),
        repository: REPOSITORY,
        target: existingWorktree,
        forwardedArgs: [],
      }).command,
    ).toBe('claude-next');
  });
});
