import { describe, expect, it } from 'vitest';

import { createPalette, shouldUseColor } from './palette.ts';

describe('shouldUseColor', () => {
  it('follows the terminal when the mode is auto', () => {
    expect(shouldUseColor('auto', true)).toBe(true);
    expect(shouldUseColor('auto', false)).toBe(false);
  });

  it('overrides the terminal when the mode is explicit', () => {
    expect(shouldUseColor('always', false)).toBe(true);
    expect(shouldUseColor('never', true)).toBe(false);
  });
});

describe('createPalette', () => {
  it('wraps values in escape sequences when colour is on', () => {
    expect(createPalette('always').accent('hi')).not.toBe('hi');
  });

  it('returns the plain value when colour is off', () => {
    const palette = createPalette('never');

    expect(palette.accent('hi')).toBe('hi');
    expect(palette.muted('hi')).toBe('hi');
    expect(palette.strong('hi')).toBe('hi');
    expect(palette.error('hi')).toBe('hi');
  });
});
