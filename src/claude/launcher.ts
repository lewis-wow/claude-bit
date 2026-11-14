import { spawn } from 'node:child_process';
import { constants } from 'node:os';

import { resetTerminalCursorColor, setTerminalCursorColor } from '../terminal/cursorColor.ts';
import { setTerminalTitle } from '../terminal/title.ts';
import type { Launch } from './plan.ts';

const SIGNAL_EXIT_CODE_BASE = 128;

const exitCodeFor = (code: number | null, signal: NodeJS.Signals | null) => {
  if (code !== null) return code;
  if (signal !== null) return SIGNAL_EXIT_CODE_BASE + constants.signals[signal];

  return 0;
};

export const launch = ({ command, args, cwd, title, color }: Launch): void => {
  setTerminalTitle(title, process.stdout);

  const colored = setTerminalCursorColor(color, process.stdout);

  const restoreCursor = () => {
    if (colored) {
      resetTerminalCursorColor(process.stdout);
    }
  };

  const child = spawn(command, args, { cwd, stdio: 'inherit' });

  child.on('error', (error: NodeJS.ErrnoException) => {
    const reason = error.code === 'ENOENT' ? `${command} was not found on PATH` : error.message;
    restoreCursor();
    console.error(reason);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    restoreCursor();
    process.exit(exitCodeFor(code, signal));
  });
};
