import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { z } from 'zod';

import { mergeConfigLayers } from './merge.ts';
import { configSchema } from './schema.ts';
import type { Config } from './schema.ts';

export const PROJECT_CONFIG_FILENAMES = ['claude-bit.json', '.claude-bit.json'] as const;

export class ConfigError extends Error {
  readonly file: string;
  readonly detail: string;

  constructor(file: string, detail: string) {
    super(`Invalid config in ${file}\n${detail}`);
    this.name = 'ConfigError';
    this.file = file;
    this.detail = detail;
  }
}

export type LoadedConfig = {
  config: Config;
  sources: string[];
};

type LoadConfigOptions = {
  cwd?: string;
  repositoryRoot?: string | undefined;
  worktreeRoot?: string | undefined;
  userConfigPath?: string | undefined;
};

const userConfigDirectory = () => process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');

const readJsonFile = (file: string): unknown => {
  let contents: string;

  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new ConfigError(file, error instanceof Error ? error.message : String(error));
  }
};

export const findConfigIn = (directory: string): string | undefined =>
  PROJECT_CONFIG_FILENAMES.map((filename) => join(resolve(directory), filename)).find((candidate) =>
    existsSync(candidate),
  );

export const findProjectConfig = (cwd: string, boundary?: string | undefined): string | undefined => {
  const stopAt = boundary === undefined ? undefined : resolve(boundary);
  let directory = resolve(cwd);

  for (;;) {
    const found = findConfigIn(directory);

    if (found !== undefined) {
      return found;
    }

    const parent = dirname(directory);

    if (directory === stopAt || parent === directory) {
      return undefined;
    }

    directory = parent;
  }
};

export const loadConfig = ({
  cwd = process.cwd(),
  repositoryRoot,
  worktreeRoot,
  userConfigPath = join(userConfigDirectory(), 'claude-bit', 'config.json'),
}: LoadConfigOptions = {}): LoadedConfig => {
  const candidates = [
    userConfigPath,
    repositoryRoot === undefined ? undefined : findConfigIn(repositoryRoot),
    findProjectConfig(cwd, worktreeRoot ?? repositoryRoot),
  ].filter((file) => file !== undefined);

  const layers = [...new Set(candidates)]
    .map((file) => ({ file, contents: readJsonFile(file) }))
    .filter((layer) => layer.contents !== undefined);

  for (const layer of layers) {
    const layerResult = configSchema.safeParse(layer.contents);

    if (!layerResult.success) {
      throw new ConfigError(layer.file, z.prettifyError(layerResult.error));
    }
  }

  const result = configSchema.safeParse(mergeConfigLayers(...layers.map((layer) => layer.contents)));

  if (!result.success) {
    throw new ConfigError(layers.at(-1)?.file ?? '<defaults>', z.prettifyError(result.error));
  }

  return { config: result.data, sources: layers.map((layer) => layer.file) };
};
