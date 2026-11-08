import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasStoredSession, sessionDirectoryFor, sessionDirectoryName } from './sessions.ts';

let sessionsDirectory: string;

beforeEach(() => {
  sessionsDirectory = mkdtempSync(join(tmpdir(), 'claude-bit-sessions-'));
});

afterEach(() => {
  rmSync(sessionsDirectory, { recursive: true, force: true });
});

const seedSession = (projectPath: string, filename: string) => {
  const directory = sessionDirectoryFor(projectPath, sessionsDirectory);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, filename), '');
};

describe('sessionDirectoryName', () => {
  it('replaces every non-alphanumeric character with a dash', () => {
    expect(sessionDirectoryName('/repo-wt/feat_1')).toBe('-repo-wt-feat-1');
  });

  it('resolves a relative path first, so the same project maps to one directory', () => {
    expect(sessionDirectoryName('.')).toBe(sessionDirectoryName(process.cwd()));
  });
});

describe('hasStoredSession', () => {
  it('is true when a transcript exists', () => {
    seedSession('/repo', 'abc.jsonl');

    expect(hasStoredSession('/repo', sessionsDirectory)).toBe(true);
  });

  it('is false when the directory holds no transcript', () => {
    seedSession('/repo', 'notes.txt');

    expect(hasStoredSession('/repo', sessionsDirectory)).toBe(false);
  });

  it('is false when the project has never been opened', () => {
    expect(hasStoredSession('/never-seen', sessionsDirectory)).toBe(false);
  });

  it('is false when the sessions directory itself is missing', () => {
    expect(hasStoredSession('/repo', join(sessionsDirectory, 'absent'))).toBe(false);
  });
});
