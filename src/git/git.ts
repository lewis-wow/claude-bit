import { execFileSync } from 'node:child_process';

export type GitRunner = (args: string[], options?: { cwd?: string }) => string;

export const runGit: GitRunner = (args, options = {}) =>
  execFileSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
