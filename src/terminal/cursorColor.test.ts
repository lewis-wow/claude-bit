import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { ChangeType } from '../changeType.ts';
import {
  cursorColorSequence,
  defaultCursorColorSequence,
  resetTerminalCursorColor,
  setTerminalCursorColor,
} from './cursorColor.ts';
import { sessionColorFor } from './sessionColor.ts';

const FEAT = sessionColorFor('x', ChangeType.Feat);

const streamOn = (isTTY: boolean) => {
  const stream = new PassThrough() as PassThrough & { isTTY?: boolean };
  const chunks: string[] = [];

  stream.isTTY = isTTY;
  stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

  return { stream, written: () => chunks.join('') };
};

describe('cursorColorSequence', () => {
  it('writes the colour as an OSC 12 request', () => {
    expect(cursorColorSequence({ red: 12, green: 205, blue: 0 })).toBe(']12;rgb:0c/cd/00');
  });

  it('gives different colours different sequences', () => {
    expect(cursorColorSequence(FEAT)).not.toBe(cursorColorSequence(sessionColorFor('x', ChangeType.Fix)));
  });
});

describe('defaultCursorColorSequence', () => {
  it('hands the cursor back to the terminal', () => {
    expect(defaultCursorColorSequence()).toBe(']112');
  });
});

describe('setTerminalCursorColor', () => {
  it('writes the sequence to a terminal', () => {
    const { stream, written } = streamOn(true);

    expect(setTerminalCursorColor(FEAT, stream)).toBe(true);
    expect(written()).toBe(cursorColorSequence(FEAT));
  });

  it('writes nothing when the stream is not a terminal', () => {
    const { stream, written } = streamOn(false);

    expect(setTerminalCursorColor(FEAT, stream)).toBe(false);
    expect(written()).toBe('');
  });
});

describe('resetTerminalCursorColor', () => {
  it('restores the default on a terminal', () => {
    const { stream, written } = streamOn(true);

    expect(resetTerminalCursorColor(stream)).toBe(true);
    expect(written()).toBe(defaultCursorColorSequence());
  });
});
