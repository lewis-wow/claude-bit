import { describe, expect, it, vi } from 'vitest';

import { resolveLaunch } from './app.ts';
import type { Dependencies, RunOptions } from './app.ts';
import { TargetKind } from './claude/targetKind.ts';
import { defaultConfig } from './config/schema.ts';
import type { Config } from './config/schema.ts';
import { COMMIT_FIELD_SEPARATOR } from './git/porcelain.ts';
import { ResolutionKind } from './resolutionKind.ts';

const WORKTREE_LIST = [
  'worktree /repo\nHEAD aaa\nbranch refs/heads/main\n',
  'worktree /repo-wt/api\nHEAD bbb\nbranch refs/heads/feat/api\n',
].join('\n');

const COMMITS = [
  ['aaa', '200', '1 hour ago'].join(COMMIT_FIELD_SEPARATOR),
  ['bbb', '100', '3 days ago'].join(COMMIT_FIELD_SEPARATOR),
].join('\n');

const gitInRepo = () => (args: string[]) => {
  if (args[0] === 'rev-parse') return '/repo/.git';
  if (args[0] === 'worktree') return WORKTREE_LIST;
  if (args[0] === 'show') return COMMITS;

  throw new Error(`unexpected git invocation: ${args.join(' ')}`);
};

const gitOutsideRepo = () => () => {
  throw new Error('fatal: not a git repository');
};

const resolve = (
  options: Partial<RunOptions> = {},
  dependencies: Partial<Dependencies> = {},
  config: Partial<Config> = {},
) =>
  resolveLaunch(
    { argv: [], cwd: '/repo', isInteractive: true, ...options },
    {
      git: gitInRepo(),
      readConfig: () => ({ config: { ...defaultConfig(), ...config }, sources: [] }),
      hasSession: () => false,
      pick: async () => ({
        kind: TargetKind.Existing,
        path: '/repo',
        branch: 'main',
        hasStoredSession: false,
      }),
      ...dependencies,
    },
  );

const launchOf = async (...args: Parameters<typeof resolve>) => {
  const resolution = await resolve(...args);

  if (resolution.kind === ResolutionKind.Cancelled) {
    throw new Error('expected a launch, got a cancellation');
  }

  return resolution.launch;
};

describe('resolveLaunch inside a repository', () => {
  it('asks the picker where to run', async () => {
    const pick = vi.fn(async () => ({
      kind: TargetKind.Existing,
      path: '/repo-wt/api',
      branch: 'feat/api',
      hasStoredSession: false,
    }));

    expect((await launchOf({}, { pick })).cwd).toBe('/repo-wt/api');
    expect(pick).toHaveBeenCalledOnce();
  });

  it('reports a cancelled picker instead of launching', async () => {
    expect(await resolve({}, { pick: async () => undefined })).toEqual({ kind: ResolutionKind.Cancelled });
  });

  it('adds --continue when the chosen worktree has a stored session', async () => {
    const launch = await launchOf({}, { hasSession: () => true });

    expect(launch.args).toContain('--continue');
  });

  it('scopes the config search to the repository', async () => {
    const readConfig = vi.fn(() => ({ config: defaultConfig(), sources: [] }));
    await resolve({}, { readConfig });

    expect(readConfig).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryRoot: '/repo', worktreeRoot: '/repo' }),
    );
  });

  it('scopes the config search to the worktree the user is standing in', async () => {
    const readConfig = vi.fn(() => ({ config: defaultConfig(), sources: [] }));
    await resolve({ cwd: '/repo-wt/api/src' }, { readConfig });

    expect(readConfig).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryRoot: '/repo', worktreeRoot: '/repo-wt/api' }),
    );
  });
});

describe('resolveLaunch when prompting is impossible or unwanted', () => {
  const noPicker = { pick: vi.fn(async () => undefined) };

  it('skips the picker when stdin is not a terminal', async () => {
    const launch = await launchOf({ isInteractive: false }, noPicker);

    expect(noPicker.pick).not.toHaveBeenCalled();
    expect(launch.cwd).toBe('/repo');
  });

  it('skips the picker when it is disabled in config', async () => {
    const launch = await launchOf({}, noPicker, {
      picker: { ...defaultConfig().picker, enabled: false },
    });

    expect(launch.cwd).toBe('/repo');
  });

  it('skips the picker when argv already names a session', async () => {
    const launch = await launchOf({ argv: ['--resume'] }, noPicker);

    expect(launch.args).toContain('--resume');
  });

  it('leaves session continuation to claude when a passthrough flag is present', async () => {
    const launch = await launchOf({ argv: ['--resume'] }, { ...noPicker, hasSession: () => true });

    expect(launch.args).not.toContain('--continue');
  });

  it('uses the worktree the user is standing in', async () => {
    const launch = await launchOf({ cwd: '/repo-wt/api/src', isInteractive: false }, noPicker);

    expect(launch.cwd).toBe('/repo-wt/api');
    expect(launch.title).toBe('api · feat/api');
  });

  it('titles the main checkout with its branch when the cwd matches no worktree', async () => {
    const launch = await launchOf({ cwd: '/elsewhere', isInteractive: false }, noPicker);

    expect(launch.cwd).toBe('/repo');
    expect(launch.title).toBe('repo · main');
  });
});

describe('resolveLaunch outside a repository', () => {
  it('runs in the current directory', async () => {
    const launch = await launchOf({ cwd: '/tmp/scratch' }, { git: gitOutsideRepo() });

    expect(launch.cwd).toBe('/tmp/scratch');
  });

  it('still continues a stored session there', async () => {
    const launch = await launchOf({ cwd: '/tmp/scratch' }, { git: gitOutsideRepo(), hasSession: () => true });

    expect(launch.args).toContain('--continue');
  });

  it('never opens the picker', async () => {
    const pick = vi.fn(async () => undefined);
    await launchOf({ cwd: '/tmp/scratch' }, { git: gitOutsideRepo(), pick });

    expect(pick).not.toHaveBeenCalled();
  });
});
