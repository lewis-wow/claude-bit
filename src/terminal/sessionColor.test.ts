import { describe, expect, it } from 'vitest';

import { CHANGE_TYPES, ChangeType } from '../changeType.ts';
import { sessionColorFor } from './sessionColor.ts';
import type { SessionColor } from './sessionColor.ts';

const chroma = (color: SessionColor) => {
  const channels = Object.values(color);

  return Math.max(...channels) - Math.min(...channels);
};

const typeColors = CHANGE_TYPES.map((type) => sessionColorFor(type, type));

const freeNames = ['main', 'spike', 'hotfix', 'release-2', 'wip', 'scratch', 'repo-alpha'];
const freeColors = freeNames.map((name) => sessionColorFor(name, undefined));

describe('sessionColorFor, for a worktree with a type', () => {
  it('gives the same type the same colour every time', () => {
    expect(sessionColorFor('a', ChangeType.Feat)).toEqual(sessionColorFor('b', ChangeType.Feat));
  });

  it('gives every type a colour of its own', () => {
    expect(new Set(typeColors.map((color) => JSON.stringify(color))).size).toBe(CHANGE_TYPES.length);
  });

  it('keeps every type vivid, so it reads as a type at a glance', () => {
    for (const color of typeColors) {
      expect(chroma(color)).toBeGreaterThan(90);
    }
  });
});

describe('sessionColorFor, for a worktree named freely', () => {
  it('gives the same name the same colour every time', () => {
    expect(sessionColorFor('spike', undefined)).toEqual(sessionColorFor('spike', undefined));
  });

  it('gives different names colours of their own', () => {
    expect(new Set(freeColors.map((color) => JSON.stringify(color))).size).toBeGreaterThan(3);
  });

  it('stays quieter than any type, so a free name never passes for one', () => {
    for (const free of freeColors) {
      expect(chroma(free)).toBeLessThan(Math.min(...typeColors.map(chroma)));
    }
  });

  it('never lands on a colour a type already owns', () => {
    const typed = typeColors.map((color) => JSON.stringify(color));

    for (const free of freeColors) {
      expect(typed).not.toContain(JSON.stringify(free));
    }
  });
});

describe('sessionColorFor, whatever the worktree', () => {
  it('stays bright enough to read on a dark terminal', () => {
    for (const color of [...typeColors, ...freeColors]) {
      expect(Math.max(...Object.values(color))).toBeGreaterThan(150);
    }
  });
});
