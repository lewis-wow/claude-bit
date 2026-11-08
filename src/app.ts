import { planLaunch, usesPassthroughFlag } from './claude/plan.ts';
import type { Launch, LaunchTarget } from './claude/plan.ts';
import { defaultSessionsDirectory, expandHome, hasStoredSession } from './claude/sessions.ts';
import { loadConfig } from './config/load.ts';
import type { Config } from './config/schema.ts';
import { runGit } from './git/git.ts';
import type { GitRunner } from './git/git.ts';
import { findEnclosingWorktree, openRepository } from './git/repository.ts';
import type { Repository, Worktree } from './git/repository.ts';
import { createPalette } from './terminal/palette.ts';
import { pickTarget } from './ui/picker.ts';

export type RunOptions = {
  argv: readonly string[];
  cwd: string;
  isInteractive: boolean;
};

type SessionLookup = typeof hasStoredSession;

export type Dependencies = {
  git: GitRunner;
  readConfig: typeof loadConfig;
  hasSession: SessionLookup;
  pick: typeof pickTarget;
};

const defaultDependencies: Dependencies = {
  git: runGit,
  readConfig: loadConfig,
  hasSession: hasStoredSession,
  pick: pickTarget,
};

export type Resolution = { launch: Launch } | { cancelled: true };

const sessionsDirectoryFor = (config: Config) =>
  config.sessionsDirectory === null ? defaultSessionsDirectory() : expandHome(config.sessionsDirectory);

const implicitTarget = (repository: Repository, enclosing: Worktree | undefined): LaunchTarget => {
  const worktree = enclosing ?? repository.worktrees.find((candidate) => candidate.isMainCheckout);

  return {
    kind: 'existing',
    path: worktree?.path ?? repository.root,
    branch: worktree?.branch,
    hasStoredSession: false,
  };
};

const withSessionState = (
  target: LaunchTarget,
  {
    config,
    hasSession,
    passesThrough,
  }: { config: Config; hasSession: SessionLookup; passesThrough: boolean },
): LaunchTarget =>
  target.kind === 'new'
    ? target
    : {
        ...target,
        hasStoredSession: !passesThrough && hasSession(target.path, sessionsDirectoryFor(config)),
      };

export const resolveLaunch = async (
  { argv, cwd, isInteractive }: RunOptions,
  dependencies: Partial<Dependencies> = {},
): Promise<Resolution> => {
  const { git, readConfig, hasSession, pick } = { ...defaultDependencies, ...dependencies };

  const repository = openRepository({ git, cwd });
  const enclosing = repository && findEnclosingWorktree(repository.worktrees, cwd);
  const primaryWorktree = repository?.worktrees.find((worktree) => worktree.isMainCheckout);
  const { config } = readConfig({
    cwd,
    repositoryRoot: primaryWorktree?.path,
    worktreeRoot: enclosing?.path,
  });

  const passesThrough = usesPassthroughFlag(argv, config.picker.passthroughFlags);
  const canPrompt = isInteractive && config.picker.enabled && !passesThrough;

  const sessionState = { config, hasSession, passesThrough };

  if (repository === undefined) {
    const target = withSessionState(
      { kind: 'existing', path: cwd, branch: undefined, hasStoredSession: false },
      sessionState,
    );

    return {
      launch: planLaunch({
        config,
        repository: { root: cwd, directory: cwd },
        target,
        forwardedArgs: argv,
      }),
    };
  }

  const chosen = canPrompt
    ? await pick({ repository, config, palette: createPalette(config.color), cwd })
    : implicitTarget(repository, enclosing);

  if (chosen === undefined) {
    return { cancelled: true };
  }

  return {
    launch: planLaunch({
      config,
      repository,
      target: withSessionState(chosen, sessionState),
      forwardedArgs: argv,
    }),
  };
};
