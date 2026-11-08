import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const SESSION_FILE_EXTENSION = '.jsonl';

export const defaultSessionsDirectory = (): string => join(homedir(), '.claude', 'projects');

export const expandHome = (path: string): string =>
  path === '~' || path.startsWith(`~${sep}`) ? join(homedir(), path.slice(1)) : path;

export const sessionDirectoryName = (projectPath: string): string =>
  resolve(projectPath).replaceAll(/[^a-zA-Z0-9]/gu, '-');

export const sessionDirectoryFor = (projectPath: string, sessionsDirectory: string): string =>
  join(sessionsDirectory, sessionDirectoryName(projectPath));

export const hasStoredSession = (projectPath: string, sessionsDirectory: string): boolean => {
  try {
    return readdirSync(sessionDirectoryFor(projectPath, sessionsDirectory)).some((entry) =>
      entry.endsWith(SESSION_FILE_EXTENSION),
    );
  } catch {
    return false;
  }
};
