import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

/**
 * Detecting whether Claude Code already has a conversation for a directory.
 *
 * Claude Code stores each project's transcripts in a directory named after
 * the project path with every non-alphanumeric character replaced by a dash.
 */

const SESSION_FILE_EXTENSION = '.jsonl';

export const defaultSessionsDirectory = (): string => join(homedir(), '.claude', 'projects');

/**
 * Expands a leading `~/`. A shell would have done this before the value ever
 * reached us, but a path written in a config file arrives literally, and an
 * unexpanded `~` would silently resolve against the launch directory.
 */
export const expandHome = (path: string): string =>
  path === '~' || path.startsWith(`~${sep}`) ? join(homedir(), path.slice(1)) : path;

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
