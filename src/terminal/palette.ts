import pico from 'picocolors';

import { ColorMode } from './colorMode.ts';

export type Palette = {
  accent: (value: string) => string;
  muted: (value: string) => string;
  strong: (value: string) => string;
  error: (value: string) => string;
};

export const shouldUseColor = (mode: ColorMode, supported = pico.isColorSupported): boolean => {
  if (mode === ColorMode.Always) return true;
  if (mode === ColorMode.Never) return false;

  return supported;
};

export const createPalette = (mode: ColorMode, supported?: boolean): Palette => {
  const colors = pico.createColors(shouldUseColor(mode, supported));

  return {
    accent: colors.cyan,
    muted: colors.dim,
    strong: colors.bold,
    error: colors.red,
  };
};
