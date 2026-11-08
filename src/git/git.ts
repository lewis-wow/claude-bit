import { execFileSync } from 'node:child_process';

/**
 * Runs a git command and returns its trimmed stdout.
 *
 * Taking this as a parameter rather than importing it directly keeps every
 * caller testable without a real repository on disk.
 */
export type GitRunner = (args: string[], options?: { cwd?: string }) => string;

export const runGit: GitRunner = (args, options = {}) =>
  execFileSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
