import { dirname, resolve, sep } from 'node:path';

import type { GitRunner } from './git.ts';
import { COMMIT_FORMAT, parseCommitSummaries, parseWorktreeList } from './porcelain.ts';
import type { CommitSummary, WorktreeRecord } from './porcelain.ts';

export type Worktree = WorktreeRecord & {
  /** True for the repository's original checkout, false for linked worktrees. */
  isMainCheckout: boolean;
  /** Commit details for `head`, absent for a bare or unborn checkout. */
  commit: CommitSummary | undefined;
};

export type Repository = {
  /**
   * Identifies the repository: the directory holding the git common directory.
   * That is the main checkout in the usual layout, but in the increasingly
   * common bare layout (`proj/.bare` beside `proj/main`, `proj/feat-x`) it is
   * `proj`, which is not a worktree at all — so never run anything here.
   */
  directory: string;
  /** A real worktree to run `claude --worktree` from. */
  root: string;
  /** Main checkout first when there is one, then the rest by most recent commit. */
  worktrees: Worktree[];
};

type OpenRepositoryOptions = {
  git: GitRunner;
  cwd: string;
};

const readRepositoryDirectory = (git: GitRunner, cwd: string) =>
  dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd }));

/**
 * Commit details are decoration — they make the picker readable but nothing
 * depends on them, so a repository git cannot describe still works.
 */
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

/**
 * Describes the git repository containing `cwd`, or `undefined` when there
 * is none. Worktrees come back in the order the picker should show them.
 */
export const openRepository = ({ git, cwd }: OpenRepositoryOptions): Repository | undefined => {
  let directory: string;
  let records: WorktreeRecord[];

  try {
    directory = readRepositoryDirectory(git, cwd);
    records = parseWorktreeList(git(['worktree', 'list', '--porcelain'], { cwd }));
  } catch {
    return undefined;
  }

  // The bare repository has no working tree, so it is not somewhere to run.
  const checkouts = records.filter((record) => !record.isBare);

  const commits = readCommitSummaries(
    git,
    cwd,
    checkouts.map((record) => record.head),
  );

  const worktrees = checkouts.map((record) => ({
    ...record,
    // In a bare layout `directory` matches no worktree, so nothing is marked —
    // which is correct: such a repository has no main checkout.
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

/**
 * Finds the worktree the given directory sits inside, preferring the deepest
 * match so a worktree nested under another one still wins.
 */
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
