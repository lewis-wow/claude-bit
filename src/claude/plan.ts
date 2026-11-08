import { basename } from 'node:path';

import type { Config } from '../config/schema.ts';
import { renderTitleTemplate } from '../terminal/title.ts';
import type { TitleTokens } from '../terminal/title.ts';

/**
 * Turns a chosen target plus configuration into the exact command to run.
 *
 * This is the whole decision layer of the wrapper and it is pure, so the
 * behaviour that matters — which flags Claude receives, in what order — is
 * checked by tests rather than by running the real binary.
 */

export type LaunchTarget =
  | {
      kind: 'existing';
      /** Absolute path of a worktree that is already checked out. */
      path: string;
      branch: string | undefined;
      hasStoredSession: boolean;
    }
  | {
      kind: 'new';
      /** Name of a worktree Claude should create, relative to the main checkout. */
      name: string;
    };

export type Launch = {
  command: string;
  args: string[];
  cwd: string;
  /** Terminal window title, or `undefined` when titles are turned off. */
  title: string | undefined;
};

type PlanLaunchOptions = {
  config: Config;
  /** Absolute path of the main checkout. */
  repo: string;
  target: LaunchTarget;
  /** Arguments the user typed, forwarded verbatim. */
  forwardedArgs: readonly string[];
};

/** The name a worktree is known by: its directory for existing ones, the requested name for new ones. */
const worktreeName = (target: LaunchTarget) =>
  target.kind === 'existing' ? basename(target.path) : target.name;

const titleTokensFor = (target: LaunchTarget, repo: string): TitleTokens => ({
  worktree: worktreeName(target),
  branch: target.kind === 'existing' ? target.branch : undefined,
  repo: basename(repo),
  path: target.kind === 'existing' ? target.path : repo,
});

const renderOptionalTemplate = (template: string | null, tokens: TitleTokens) => {
  if (template === null) {
    return undefined;
  }

  const rendered = renderTitleTemplate(template, tokens);

  return rendered.length > 0 ? rendered : undefined;
};

/**
 * True when argv already says which session to start, so the picker would
 * only get in the way. Matches `--flag` and `--flag=value`, never a prompt
 * that merely mentions a flag.
 */
export const usesPassthroughFlag = (argv: readonly string[], flags: readonly string[]): boolean => {
  const known = new Set(flags);

  return argv.some((argument) => known.has(argument.split('=')[0] ?? argument));
};

export const planLaunch = ({ config, repo, target, forwardedArgs }: PlanLaunchOptions): Launch => {
  const tokens = titleTokensFor(target, repo);
  const sessionName = renderOptionalTemplate(config.terminal.sessionName, tokens);

  const targetArgs =
    target.kind === 'new'
      ? ['--worktree', target.name, ...config.worktree.args]
      : config.resumeExistingSession && target.hasStoredSession
        ? ['--continue']
        : [];

  return {
    command: config.command,
    cwd: target.kind === 'new' ? repo : target.path,
    title: renderOptionalTemplate(config.terminal.title, tokens),
    args: [
      ...config.args,
      ...targetArgs,
      ...(sessionName === undefined ? [] : ['--name', sessionName]),
      ...forwardedArgs,
    ],
  };
};
