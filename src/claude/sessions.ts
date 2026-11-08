import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Detecting whether Claude Code already has a conversation for a directory.
 *
 * Claude Code stores each project's transcripts in a directory named after
 * the project path with every non-alphanumeric character replaced by a dash.
 */

const SESSION_FILE_EXTENSION = '.jsonl';

export const defaultSessionsDirectory = (): string => join(homedir(), '.claude', 'projects');

/** Mirrors Claude Code's own mangling of a project path into a directory name. */
export const sessionDirectoryName = (projectPath: string): string =>
  resolve(projectPath).replaceAll(/[^a-zA-Z0-9]/gu, '-');

export const sessionDirectoryFor = (projectPath: string, sessionsDirectory: string): string =>
  join(sessionsDirectory, sessionDirectoryName(projectPath));

/** True when at least one transcript exists, which is what makes `--continue` meaningful. */
export const hasStoredSession = (projectPath: string, sessionsDirectory: string): boolean => {
  try {
    return readdirSync(sessionDirectoryFor(projectPath, sessionsDirectory)).some((entry) =>
      entry.endsWith(SESSION_FILE_EXTENSION),
    );
  } catch {
    return false;
  }
};
