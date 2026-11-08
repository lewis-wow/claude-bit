import { describe, expect, it } from 'vitest';

import { mergeConfigLayers } from './merge.ts';

describe('mergeConfigLayers', () => {
  it('lets later layers win', () => {
    expect(mergeConfigLayers({ command: 'claude' }, { command: 'claude-next' })).toEqual({
      command: 'claude-next',
    });
  });

  it('merges nested objects key by key', () => {
    const merged = mergeConfigLayers(
      { picker: { enabled: true, maxItems: 12 } },
      { picker: { maxItems: 5 } },
    );

    expect(merged).toEqual({ picker: { enabled: true, maxItems: 5 } });
  });

  it('replaces arrays instead of concatenating them', () => {
    const merged = mergeConfigLayers({ args: ['--a', '--b'] }, { args: ['--c'] });

    expect(merged).toEqual({ args: ['--c'] });
  });

  it('keeps an explicit null, which is how a template is disabled', () => {
    expect(mergeConfigLayers({ terminal: { title: '{worktree}' } }, { terminal: { title: null } })).toEqual({
      terminal: { title: null },
    });
  });

  it('ignores undefined values so a missing key never erases a lower layer', () => {
    expect(mergeConfigLayers({ command: 'claude' }, { command: undefined })).toEqual({
      command: 'claude',
    });
  });

  it('ignores layers that are not objects', () => {
    expect(mergeConfigLayers(undefined, { command: 'claude' }, null, ['nope'])).toEqual({
      command: 'claude',
    });
  });

  it('does not mutate the layers it was given', () => {
    const base = { picker: { maxItems: 12 } };
    mergeConfigLayers(base, { picker: { maxItems: 3 } });

    expect(base).toEqual({ picker: { maxItems: 12 } });
  });
});
