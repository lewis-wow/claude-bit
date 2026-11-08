import pico from 'picocolors';

import type { Config } from '../config/schema.ts';

export type Palette = {
  accent: (value: string) => string;
  muted: (value: string) => string;
  strong: (value: string) => string;
  error: (value: string) => string;
};

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
