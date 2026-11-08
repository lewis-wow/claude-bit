import { planLaunch, usesPassthroughFlag } from './claude/plan.ts';
import type { Launch, LaunchTarget } from './claude/plan.ts';
import { defaultSessionsDirectory, hasStoredSession } from './claude/sessions.ts';
import { loadConfig } from './config/load.ts';
import type { Config } from './config/schema.ts';
import { runGit } from './git/git.ts';
import type { GitRunner } from './git/git.ts';
import { findEnclosingWorktree, openRepository } from './git/repository.ts';
import type { Repository, Worktree } from './git/repository.ts';
import { createPalette } from './terminal/palette.ts';
import { pickTarget } from './ui/picker.ts';

/**
 * Decides what a single `claude-bit` invocation should do.
 *
 * The flow is: find the repository, load configuration, choose a worktree,
 * plan the launch. Side effects live at the edges — this module returns a
 * plan and leaves spawning to the caller.
 */

export type RunOptions = {
  /** Arguments after the program name, forwarded to Claude verbatim. */
  argv: readonly string[];
  cwd: string;
  /** False when stdin is piped, which rules out prompting. */
  isInteractive: boolean;
};

type SessionLookup = typeof hasStoredSession;

/** Injection points, defaulted to the real implementations. */
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

/** Either a command to run, or the news that the user backed out of the picker. */
export type Resolution = { launch: Launch } | { cancelled: true };

const sessionsDirectoryFor = (config: Config) => config.sessionsDirectory ?? defaultSessionsDirectory();

/**
 * The worktree to use when the picker is out of the question — either the one
 * the user is standing in, or the main checkout.
 */
const implicitTarget = (repository: Repository, enclosing: Worktree | undefined): LaunchTarget => {
  const worktree = enclosing ?? repository.worktrees.find((candidate) => candidate.isMainCheckout);

  return {
    kind: 'existing',
    path: worktree?.path ?? repository.mainCheckout,
    branch: worktree?.branch,
    hasStoredSession: false,
  };
};

/**
 * Fills in whether the chosen directory already has a conversation. A target
 * the user reached through a passthrough flag is left alone, because those
 * flags are Claude's own answer to the same question.
 */
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
  const { config } = readConfig({
    cwd,
    repositoryRoot: repository?.mainCheckout,
    worktreeRoot: enclosing?.path,
  });

  // Flags such as `--resume` already name a session, so the picker is noise
  // and Claude — not this wrapper — decides whether to continue a session.
  const passesThrough = usesPassthroughFlag(argv, config.picker.passthroughFlags);
  const canPrompt = isInteractive && config.picker.enabled && !passesThrough;

  const sessionState = { config, hasSession, passesThrough };

  if (repository === undefined) {
    const target = withSessionState(
      { kind: 'existing', path: cwd, branch: undefined, hasStoredSession: false },
      sessionState,
    );

    return { launch: planLaunch({ config, repo: cwd, target, forwardedArgs: argv }) };
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
      repo: repository.mainCheckout,
      target: withSessionState(chosen, sessionState),
      forwardedArgs: argv,
    }),
  };
};
