import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { composeTitle, setTerminalTitle, terminalTitleSequence } from './title.ts';

describe('composeTitle', () => {
  it('joins the parts it was given', () => {
    expect(composeTitle(['api', 'feat/x'])).toBe('api · feat/x');
  });

  it('drops the separator when a part is missing', () => {
    expect(composeTitle(['api', undefined])).toBe('api');
  });

  it('drops a leading separator when the first part is missing', () => {
    expect(composeTitle([undefined, 'api'])).toBe('api');
  });

  it('collapses the separators between several missing parts', () => {
    expect(composeTitle([undefined, undefined, 'api'])).toBe('api');
  });

  it('ignores a part that is only whitespace', () => {
    expect(composeTitle(['api', '   '])).toBe('api');
  });

  it('does not trim dashes that belong to a branch name', () => {
    expect(composeTitle(['feat/my-thing'])).toBe('feat/my-thing');
  });

  it('returns an empty string when every part is missing', () => {
    expect(composeTitle([undefined, undefined])).toBe('');
  });
});

describe('terminalTitleSequence', () => {
  it('wraps the title in an OSC 0 sequence', () => {
    expect(terminalTitleSequence('api')).toBe('\u001B]0;api\u0007');
  });

  it('strips control characters that would break the sequence', () => {
    expect(terminalTitleSequence('a\u0007b\u001Bc')).toBe('\u001B]0;abc\u0007');
  });
});

describe('setTerminalTitle', () => {
  const captureStream = (isTTY: boolean) => {
    const stream = new PassThrough() as PassThrough & { isTTY?: boolean };
    const chunks: string[] = [];
    stream.isTTY = isTTY;
    stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

    return { stream, written: () => chunks.join('') };
  };

  it('writes the sequence to a terminal', () => {
    const { stream, written } = captureStream(true);

    expect(setTerminalTitle('api', stream)).toBe(true);
    expect(written()).toBe(terminalTitleSequence('api'));
  });

  it('writes nothing when the stream is not a terminal', () => {
    const { stream, written } = captureStream(false);

    expect(setTerminalTitle('api', stream)).toBe(false);
    expect(written()).toBe('');
  });

  it('writes nothing for an empty title', () => {
    const { stream, written } = captureStream(true);

    expect(setTerminalTitle('   ', stream)).toBe(false);
    expect(written()).toBe('');
  });
});
