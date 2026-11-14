#!/usr/bin/env node
import { resolveLaunch } from './app.ts';
import { launch } from './claude/launcher.ts';
import { ResolutionKind } from './resolutionKind.ts';
import { createPalette } from './terminal/palette.ts';

const CANCEL_EXIT_CODE = 130;

const main = async () => {
  const resolution = await resolveLaunch({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });

  if (resolution.kind === ResolutionKind.Cancelled) {
    process.exit(CANCEL_EXIT_CODE);
  }

  launch(resolution.launch);
};

try {
  await main();
} catch (error) {
  const palette = createPalette();

  console.error(palette.error(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
