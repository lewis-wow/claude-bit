#!/usr/bin/env node
import { resolveLaunch } from './app.ts';
import { launch } from './claude/launcher.ts';
import { createPalette } from './terminal/palette.ts';

/**
 * Entry point. Reads the process, hands off to `resolveLaunch`, and maps the
 * outcome onto an exit status.
 */

/** Conventional status for "interrupted by the user", the same one Ctrl-C yields. */
const CANCEL_EXIT_CODE = 130;

const main = async () => {
  const resolution = await resolveLaunch({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    // Both ends matter: the picker reads keys from stdin but draws on stdout,
    // so a redirected stdout would hide the prompt and look like a hang.
    isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });

  if ('cancelled' in resolution) {
    process.exit(CANCEL_EXIT_CODE);
  }

  launch(resolution.launch);
};

try {
  await main();
} catch (error) {
  // A ConfigError already carries a complete, readable message; anything else
  // is a bug, and its message is still the most useful thing to show.
  const palette = createPalette('auto');

  console.error(palette.error(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
