import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { renderTitleTemplate, setTerminalTitle, terminalTitleSequence } from './title.ts';

describe('renderTitleTemplate', () => {
  it('substitutes known tokens', () => {
    expect(renderTitleTemplate('{worktree} · {branch}', { worktree: 'api', branch: 'feat/x' })).toBe(
      'api · feat/x',
    );
  });

  it('drops the separator when a token has no value', () => {
    expect(renderTitleTemplate('{worktree} · {branch}', { worktree: 'api', branch: undefined })).toBe('api');
  });

  it('drops a leading separator when the first token is empty', () => {
    expect(renderTitleTemplate('{branch} · {worktree}', { branch: undefined, worktree: 'api' })).toBe('api');
  });

  it('collapses separators between several empty tokens', () => {
    expect(renderTitleTemplate('{repo} · {branch} · {worktree}', { worktree: 'api' })).toBe('api');
  });

  it('leaves an unknown token visible so a typo is obvious', () => {
    expect(renderTitleTemplate('{worktre}', { worktree: 'api' })).toBe('{worktre}');
  });

  it('keeps literal text around the tokens', () => {
    expect(renderTitleTemplate('claude: {worktree}', { worktree: 'api' })).toBe('claude: api');
  });

  it('does not trim dashes that belong to a branch name', () => {
    expect(renderTitleTemplate('{branch}', { branch: 'feat/my-thing' })).toBe('feat/my-thing');
  });

  it('returns an empty string when every token is empty', () => {
    expect(renderTitleTemplate('{worktree} · {branch}', {})).toBe('');
  });
});

describe('terminalTitleSequence', () => {
  it('wraps the title in an OSC 0 sequence', () => {
    expect(terminalTitleSequence('api')).toBe(']0;api');
  });

  it('strips control characters that would break the sequence', () => {
    expect(terminalTitleSequence('abc')).toBe(']0;abc');
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
