import pico from 'picocolors';

import type { Config } from '../config/schema.ts';

/**
 * The project's only vocabulary for colour.
 *
 * Call sites ask for a role — `accent`, `muted` — never for a colour, so the
 * scheme can change in one place. picocolors owns the escape sequences.
 *
 * picocolors is CommonJS, so it is imported by default export: its named
 * exports are not reliably available to Node's ESM loader.
 */

export type Palette = {
  accent: (value: string) => string;
  muted: (value: string) => string;
  strong: (value: string) => string;
  error: (value: string) => string;
};

/** Resolves `color: auto | always | never` against the terminal's capabilities. */
export const shouldUseColor = (mode: Config['color'], supported = pico.isColorSupported): boolean => {
  if (mode === 'always') return true;
  if (mode === 'never') return false;

  return supported;
};

export const createPalette = (mode: Config['color'], supported?: boolean): Palette => {
  const colors = pico.createColors(shouldUseColor(mode, supported));

  return {
    accent: colors.cyan,
    muted: colors.dim,
    strong: colors.bold,
    error: colors.red,
  };
};
