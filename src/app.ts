import { planLaunch, usesPassthroughFlag } from './claude/plan.ts';
import type { Launch, LaunchTarget } from './claude/plan.ts';
import { defaultSessionsDirectory, expandHome, hasStoredSession } from './claude/sessions.ts';
import { TargetKind } from './claude/targetKind.ts';
import { loadConfig } from './config/load.ts';
import type { Config } from './config/schema.ts';
import { runGit } from './git/git.ts';
import type { GitRunner } from './git/git.ts';
import { findEnclosingWorktree, openRepository } from './git/repository.ts';
import type { Repository, Worktree } from './git/repository.ts';
import { ResolutionKind } from './resolutionKind.ts';
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

export type Resolution =
  | { kind: typeof ResolutionKind.Launch; launch: Launch }
  | { kind: typeof ResolutionKind.Cancelled };

const sessionsDirectoryFor = (config: Config) =>
  config.sessionsDirectory === null ? defaultSessionsDirectory() : expandHome(config.sessionsDirectory);

const implicitTarget = (repository: Repository, enclosing: Worktree | undefined): LaunchTarget => {
  const worktree = enclosing ?? repository.worktrees.find((candidate) => candidate.isMainCheckout);

  return {
    kind: TargetKind.Existing,
    path: worktree?.path ?? repository.root,
    branch: worktree?.branch,
    hasStoredSession: false,
  };
};

const withSessionState = (
  target: LaunchTarget,
  { config, hasSession, passesThrough }: SessionState,
): LaunchTarget =>
  target.kind === TargetKind.New
    ? target
    : {
        ...target,
        hasStoredSession: !passesThrough && hasSession(target.path, sessionsDirectoryFor(config)),
      };

type SessionState = { config: Config; hasSession: SessionLookup; passesThrough: boolean };

const launchOutsideRepository = ({
  config,
  cwd,
  forwardedArgs,
  sessionState,
}: {
  config: Config;
  cwd: string;
  forwardedArgs: readonly string[];
  sessionState: SessionState;
}): Resolution => ({
  kind: ResolutionKind.Launch,
  launch: planLaunch({
    config,
    repository: { root: cwd, directory: cwd },
    target: withSessionState(
      { kind: TargetKind.Existing, path: cwd, branch: undefined, hasStoredSession: false },
      sessionState,
    ),
    forwardedArgs,
  }),
});

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
    return launchOutsideRepository({ config, cwd, forwardedArgs: argv, sessionState });
  }

  const chosen = canPrompt
    ? await pick({ repository, config, palette: createPalette(config.color), cwd })
    : implicitTarget(repository, enclosing);

  if (chosen === undefined) {
    return { kind: ResolutionKind.Cancelled };
  }

  return {
    kind: ResolutionKind.Launch,
    launch: planLaunch({
      config,
      repository,
      target: withSessionState(chosen, sessionState),
      forwardedArgs: argv,
    }),
  };
};
