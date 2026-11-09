import { dirname, resolve, sep } from 'node:path';

import type { GitRunner } from './git.ts';
import { COMMIT_FORMAT, parseCommitSummaries, parseWorktreeList } from './porcelain.ts';
import type { CommitSummary, WorktreeRecord } from './porcelain.ts';

export type Worktree = WorktreeRecord & {
  isMainCheckout: boolean;
  commit: CommitSummary | undefined;
};

export type Repository = {
  directory: string;
  root: string;
  worktrees: Worktree[];
};

type OpenRepositoryOptions = {
  git: GitRunner;
  cwd: string;
};

const readRepositoryDirectory = (git: GitRunner, cwd: string) =>
  dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd }));

const readCommitSummaries = (git: GitRunner, cwd: string, heads: string[]) => {
  const revisions = [...new Set(heads.filter(Boolean))];

  if (revisions.length === 0) {
    return new Map<string, CommitSummary>();
  }

  try {
    return parseCommitSummaries(git(['show', '-s', `--format=${COMMIT_FORMAT}`, ...revisions], { cwd }));
  } catch {
    return new Map<string, CommitSummary>();
  }
};

const byMostRecentCommit = (a: Worktree, b: Worktree) =>
  (b.commit?.committedAt ?? 0) - (a.commit?.committedAt ?? 0);

export const openRepository = ({ git, cwd }: OpenRepositoryOptions): Repository | undefined => {
  let directory: string;
  let records: WorktreeRecord[];

  try {
    directory = readRepositoryDirectory(git, cwd);
    records = parseWorktreeList(git(['worktree', 'list', '--porcelain'], { cwd }));
  } catch {
    return undefined;
  }

  const checkouts = records.filter((record) => !record.isBare);

  const commits = readCommitSummaries(
    git,
    cwd,
    checkouts.map((record) => record.head),
  );

  const worktrees = checkouts.map((record) => ({
    ...record,
    isMainCheckout: resolve(record.path) === resolve(directory),
    commit: commits.get(record.head),
  }));

  const main = worktrees.filter((worktree) => worktree.isMainCheckout);
  const rest = worktrees.filter((worktree) => !worktree.isMainCheckout).toSorted(byMostRecentCommit);
  const ordered = [...main, ...rest];

  return { directory, root: ordered[0]?.path ?? directory, worktrees: ordered };
};

const contains = (directory: string, candidate: string) =>
  candidate === directory || candidate.startsWith(directory + sep);

export const findEnclosingWorktree = <T extends { path: string }>(
  worktrees: readonly T[],
  cwd: string,
): T | undefined => {
  const target = resolve(cwd);

  return worktrees
    .filter((worktree) => contains(resolve(worktree.path), target))
    .toSorted((a, b) => b.path.length - a.path.length)
    .at(0);
};

export const removableWorktrees = <T extends { path: string; isMainCheckout: boolean }>(
  worktrees: readonly T[],
  cwd: string,
): T[] => {
  const enclosing = findEnclosingWorktree(worktrees, cwd);

  return worktrees.filter((worktree) => !worktree.isMainCheckout && worktree.path !== enclosing?.path);
};
