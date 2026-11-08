import { basename } from 'node:path';

import type { Config } from '../config/schema.ts';
import { renderTitleTemplate } from '../terminal/title.ts';
import type { TitleTokens } from '../terminal/title.ts';
import { TargetKind } from './target-kind.ts';

export type LaunchTarget =
  | {
      kind: typeof TargetKind.Existing;
      path: string;
      branch: string | undefined;
      hasStoredSession: boolean;
    }
  | {
      kind: typeof TargetKind.New;
      name: string;
    };

export type Launch = {
  command: string;
  args: string[];
  cwd: string;
  title: string | undefined;
};

type PlanLaunchOptions = {
  config: Config;
  repository: {
    root: string;
    directory: string;
  };
  target: LaunchTarget;
  forwardedArgs: readonly string[];
};

const worktreeName = (target: LaunchTarget) =>
  target.kind === TargetKind.Existing ? basename(target.path) : target.name;

const titleTokensFor = (target: LaunchTarget, repository: PlanLaunchOptions['repository']): TitleTokens => ({
  worktree: worktreeName(target),
  branch: target.kind === TargetKind.Existing ? target.branch : undefined,
  repo: basename(repository.directory),
  path: target.kind === TargetKind.Existing ? target.path : repository.root,
});

const renderOptionalTemplate = (template: string | null, tokens: TitleTokens) => {
  if (template === null) {
    return undefined;
  }

  const rendered = renderTitleTemplate(template, tokens);

  return rendered.length > 0 ? rendered : undefined;
};

export const usesPassthroughFlag = (argv: readonly string[], flags: readonly string[]): boolean => {
  const known = new Set(flags);

  return argv.some((argument) => known.has(argument.split('=')[0] ?? argument));
};

export const planLaunch = ({ config, repository, target, forwardedArgs }: PlanLaunchOptions): Launch => {
  const tokens = titleTokensFor(target, repository);
  const sessionName = renderOptionalTemplate(config.terminal.sessionName, tokens);

  const targetArgs =
    target.kind === TargetKind.New
      ? ['--worktree', target.name, ...config.worktree.args]
      : config.resumeExistingSession && target.hasStoredSession
        ? ['--continue']
        : [];

  return {
    command: config.command,
    cwd: target.kind === TargetKind.New ? repository.root : target.path,
    title: renderOptionalTemplate(config.terminal.title, tokens),
    args: [
      ...config.args,
      ...targetArgs,
      ...(sessionName === undefined ? [] : ['--name', sessionName]),
      ...forwardedArgs,
    ],
  };
};
