import { basename } from 'node:path';

import { changeTypeOf } from '../changeType.ts';
import { sessionColorFor } from '../terminal/sessionColor.ts';
import type { SessionColor } from '../terminal/sessionColor.ts';
import { composeTitle } from '../terminal/title.ts';
import { TargetKind } from './targetKind.ts';

export const COMMAND = 'claude';

export const BASE_ARGS: readonly string[] = ['--dangerously-skip-permissions'];

export const PASSTHROUGH_FLAGS: readonly string[] = [
  '-c',
  '--continue',
  '-r',
  '--resume',
  '-p',
  '--print',
  '-h',
  '--help',
  '-v',
  '--version',
  '-w',
  '--worktree',
  '--from-pr',
];

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
  title: string;
  color: SessionColor;
};

type PlanLaunchOptions = {
  repositoryRoot: string;
  target: LaunchTarget;
  forwardedArgs: readonly string[];
};

const worktreeName = (target: LaunchTarget) =>
  target.kind === TargetKind.Existing ? basename(target.path) : target.name;

export const usesPassthroughFlag = (argv: readonly string[]): boolean => {
  const known = new Set(PASSTHROUGH_FLAGS);

  return argv.some((argument) => known.has(argument.split('=')[0] ?? argument));
};

export const planLaunch = ({ repositoryRoot, target, forwardedArgs }: PlanLaunchOptions): Launch => {
  const name = worktreeName(target);
  const branch = target.kind === TargetKind.Existing ? target.branch : undefined;

  const targetArgs =
    target.kind === TargetKind.New
      ? ['--worktree', target.name]
      : target.hasStoredSession
        ? ['--continue']
        : [];

  return {
    command: COMMAND,
    cwd: target.kind === TargetKind.New ? repositoryRoot : target.path,
    title: composeTitle([name, branch]),
    color: sessionColorFor(name, changeTypeOf(name) ?? changeTypeOf(branch)),
    args: [...BASE_ARGS, ...targetArgs, '--name', name, ...forwardedArgs],
  };
};
