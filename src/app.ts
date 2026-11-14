import { planLaunch, usesPassthroughFlag } from './claude/plan.ts';
import type { Launch, LaunchTarget } from './claude/plan.ts';
import { defaultSessionsDirectory, hasStoredSession } from './claude/sessions.ts';
import { TargetKind } from './claude/targetKind.ts';
import { runGit } from './git/git.ts';
import type { GitRunner } from './git/git.ts';
import { findEnclosingWorktree, openRepository } from './git/repository.ts';
import type { Repository, Worktree } from './git/repository.ts';
import { ResolutionKind } from './resolutionKind.ts';
import { chooseTarget } from './ui/chooseTarget.ts';

export type RunOptions = {
  argv: readonly string[];
  cwd: string;
  isInteractive: boolean;
};

type SessionLookup = typeof hasStoredSession;

export type Dependencies = {
  git: GitRunner;
  hasSession: SessionLookup;
  choose: typeof chooseTarget;
};

const defaultDependencies: Dependencies = {
  git: runGit,
  hasSession: hasStoredSession,
  choose: chooseTarget,
};

export type Resolution =
  | { kind: typeof ResolutionKind.Launch; launch: Launch }
  | { kind: typeof ResolutionKind.Cancelled };

const implicitTarget = (repository: Repository, enclosing: Worktree | undefined): LaunchTarget => {
  const worktree = enclosing ?? repository.worktrees.find((candidate) => candidate.isMainCheckout);

  return {
    kind: TargetKind.Existing,
    path: worktree?.path ?? repository.root,
    branch: worktree?.branch,
    hasStoredSession: false,
  };
};

const withSessionState = (target: LaunchTarget, { hasSession, passesThrough }: SessionState): LaunchTarget =>
  target.kind === TargetKind.New
    ? target
    : {
        ...target,
        hasStoredSession: !passesThrough && hasSession(target.path, defaultSessionsDirectory()),
      };

type SessionState = { hasSession: SessionLookup; passesThrough: boolean };

export const resolveLaunch = async (
  { argv, cwd, isInteractive }: RunOptions,
  dependencies: Partial<Dependencies> = {},
): Promise<Resolution> => {
  const { git, hasSession, choose } = { ...defaultDependencies, ...dependencies };

  const repository = openRepository({ git, cwd });
  const enclosing = repository && findEnclosingWorktree(repository.worktrees, cwd);

  const passesThrough = usesPassthroughFlag(argv);
  const canPrompt = isInteractive && !passesThrough;

  const sessionState = { hasSession, passesThrough };

  if (repository === undefined) {
    return {
      kind: ResolutionKind.Launch,
      launch: planLaunch({
        repositoryRoot: cwd,
        target: withSessionState(
          { kind: TargetKind.Existing, path: cwd, branch: undefined, hasStoredSession: false },
          sessionState,
        ),
        forwardedArgs: argv,
      }),
    };
  }

  const chosen = canPrompt ? await choose({ repository, cwd, git }) : implicitTarget(repository, enclosing);

  if (chosen === undefined) {
    return { kind: ResolutionKind.Cancelled };
  }

  return {
    kind: ResolutionKind.Launch,
    launch: planLaunch({
      repositoryRoot: repository.root,
      target: withSessionState(chosen, sessionState),
      forwardedArgs: argv,
    }),
  };
};
