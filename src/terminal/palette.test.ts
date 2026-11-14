import { describe, expect, it } from 'vitest';

import { ChangeType } from '../changeType.ts';
import { createPalette } from './palette.ts';
import { sessionColorFor } from './sessionColor.ts';

describe('createPalette', () => {
  it('wraps values in escape sequences when colour is on', () => {
    expect(createPalette({ supported: true }).action('hi')).not.toBe('hi');
  });

  it('returns the plain value when colour is off', () => {
    const palette = createPalette({ supported: false });

    expect(palette.action('hi')).toBe('hi');
    expect(palette.danger('hi')).toBe('hi');
    expect(palette.muted('hi')).toBe('hi');
    expect(palette.strong('hi')).toBe('hi');
    expect(palette.error('hi')).toBe('hi');
    expect(palette.session(sessionColorFor('x', ChangeType.Perf))('hi')).toBe('hi');
  });

  it('paints each session colour differently', () => {
    const palette = createPalette({ supported: true });

    expect(palette.session(sessionColorFor('x', ChangeType.Perf))('hi')).not.toBe(
      palette.session(sessionColorFor('x', ChangeType.Feat))('hi'),
    );
  });

  it('sets the two actions apart from every session colour', () => {
    const palette = createPalette({ supported: true });

    expect(palette.action('hi')).not.toBe(palette.danger('hi'));
    expect(palette.action('hi')).not.toBe(palette.session(sessionColorFor('x', ChangeType.Ci))('hi'));
    expect(palette.danger('hi')).not.toBe(palette.session(sessionColorFor('x', ChangeType.Fix))('hi'));
  });
});
