import { spawn } from 'node:child_process';
import { constants } from 'node:os';

import { setTerminalTitle } from '../terminal/title.ts';
import type { Launch } from './plan.ts';

/**
 * The one place that touches the real process table.
 *
 * Everything interesting about a launch was already decided in `planLaunch`;
 * this just carries it out and makes the wrapper transparent to the shell by
 * reproducing the child's exit status.
 */

/** POSIX convention: a process killed by signal N reports status 128 + N. */
const SIGNAL_EXIT_CODE_BASE = 128;

const exitCodeFor = (code: number | null, signal: NodeJS.Signals | null) => {
  if (code !== null) return code;
  if (signal !== null) return SIGNAL_EXIT_CODE_BASE + constants.signals[signal];

  return 0;
};

export const launch = ({ command, args, cwd, title }: Launch): void => {
  if (title !== undefined) {
    setTerminalTitle(title, process.stdout);
  }

  const child = spawn(command, args, { cwd, stdio: 'inherit' });

  child.on('error', (error: NodeJS.ErrnoException) => {
    const reason = error.code === 'ENOENT' ? `${command} was not found on PATH` : error.message;
    console.error(reason);
    process.exit(1);
  });

  child.on('exit', (code, signal) => process.exit(exitCodeFor(code, signal)));
};
