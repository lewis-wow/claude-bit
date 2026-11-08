import { describe, expect, it } from 'vitest';

import { ColorMode } from './color-mode.ts';
import { createPalette, shouldUseColor } from './palette.ts';

describe('shouldUseColor', () => {
  it('follows the terminal when the mode is auto', () => {
    expect(shouldUseColor(ColorMode.Auto, true)).toBe(true);
    expect(shouldUseColor(ColorMode.Auto, false)).toBe(false);
  });

  it('overrides the terminal when the mode is explicit', () => {
    expect(shouldUseColor(ColorMode.Always, false)).toBe(true);
    expect(shouldUseColor(ColorMode.Never, true)).toBe(false);
  });
});

describe('createPalette', () => {
  it('wraps values in escape sequences when colour is on', () => {
    expect(createPalette(ColorMode.Always).accent('hi')).not.toBe('hi');
  });

  it('returns the plain value when colour is off', () => {
    const palette = createPalette(ColorMode.Never);

    expect(palette.accent('hi')).toBe('hi');
    expect(palette.muted('hi')).toBe('hi');
    expect(palette.strong('hi')).toBe('hi');
    expect(palette.error('hi')).toBe('hi');
  });
});
