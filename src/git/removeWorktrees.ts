import type { GitRunner } from './git.ts';

export type RemovalFailure = {
  path: string;
  reason: string;
};

export type RemoveWorktreesOptions = {
  git: GitRunner;
  cwd: string;
  paths: readonly string[];
};

const UNEXPLAINED_REFUSAL = 'git refused to remove the worktree';
const GIT_FATAL_PREFIX = 'fatal:';

const refusalReason = (error: unknown) => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.find((line) => line.startsWith(GIT_FATAL_PREFIX)) ?? lines.at(-1) ?? UNEXPLAINED_REFUSAL;
};

export const removeWorktrees = ({ git, cwd, paths }: RemoveWorktreesOptions): RemovalFailure[] =>
  paths.flatMap((path) => {
    try {
      git(['worktree', 'remove', path], { cwd });

      return [];
    } catch (error) {
      return [{ path, reason: refusalReason(error) }];
    }
  });
