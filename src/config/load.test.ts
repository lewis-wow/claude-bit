import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigError, findProjectConfig, loadConfig } from './load.ts';
import { defaultConfig } from './schema.ts';

let root: string;

const write = (relativePath: string, contents: unknown) => {
  const file = join(root, relativePath);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));

  return file;
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'claude-bit-config-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findProjectConfig', () => {
  it('finds a config in the starting directory', () => {
    const file = write('claude-bit.json', {});

    expect(findProjectConfig(root)).toBe(file);
  });

  it('walks up from a nested directory', () => {
    const file = write('claude-bit.json', {});
    mkdirSync(join(root, 'src', 'deep'), { recursive: true });

    expect(findProjectConfig(join(root, 'src', 'deep'))).toBe(file);
  });

  it('prefers claude-bit.json over the dotfile', () => {
    const preferred = write('claude-bit.json', {});
    write('.claude-bit.json', {});

    expect(findProjectConfig(root)).toBe(preferred);
  });

  it('accepts the dotfile when it is the only one', () => {
    const file = write('.claude-bit.json', {});

    expect(findProjectConfig(root)).toBe(file);
  });

  it('stops searching above the boundary', () => {
    write('claude-bit.json', {});
    mkdirSync(join(root, 'repo'), { recursive: true });

    expect(findProjectConfig(join(root, 'repo'), join(root, 'repo'))).toBeUndefined();
  });

  it('returns undefined when no config exists', () => {
    expect(findProjectConfig(root, root)).toBeUndefined();
  });
});

describe('loadConfig', () => {
  const missingUserConfig = () => join(root, 'absent', 'config.json');

  it('falls back to defaults when nothing is configured', () => {
    const { config, sources } = loadConfig({
      cwd: root,
      repositoryRoot: root,
      userConfigPath: missingUserConfig(),
    });

    expect(config).toEqual(defaultConfig());
    expect(sources).toEqual([]);
  });

  it('applies a project file over the defaults', () => {
    write('claude-bit.json', { picker: { maxItems: 3 } });

    const { config } = loadConfig({ cwd: root, repositoryRoot: root, userConfigPath: missingUserConfig() });

    expect(config.picker.maxItems).toBe(3);
    expect(config.picker.enabled).toBe(true);
  });

  it('lets the project file override the user file', () => {
    const userConfigPath = write('home/config.json', { command: 'claude-user', color: 'never' });
    write('claude-bit.json', { command: 'claude-project' });

    const { config, sources } = loadConfig({ cwd: root, repositoryRoot: root, userConfigPath });

    expect(config.command).toBe('claude-project');
    expect(config.color).toBe('never');
    expect(sources).toHaveLength(2);
  });

  it('reports the offending file when a value has the wrong type', () => {
    write('claude-bit.json', { picker: { maxItems: 'many' } });

    expect(() =>
      loadConfig({ cwd: root, repositoryRoot: root, userConfigPath: missingUserConfig() }),
    ).toThrow(ConfigError);
  });

  it('rejects unknown keys so typos do not pass silently', () => {
    write('claude-bit.json', { picker: { maxItem: 3 } });

    expect(() =>
      loadConfig({ cwd: root, repositoryRoot: root, userConfigPath: missingUserConfig() }),
    ).toThrow(/maxItem/u);
  });

  it('reports malformed JSON with the file name', () => {
    write('claude-bit.json', '{ not json');

    expect(() =>
      loadConfig({ cwd: root, repositoryRoot: root, userConfigPath: missingUserConfig() }),
    ).toThrow(/claude-bit\.json/u);
  });

  it('accepts a $schema key', () => {
    write('claude-bit.json', { $schema: './schema.json' });

    expect(() =>
      loadConfig({ cwd: root, repositoryRoot: root, userConfigPath: missingUserConfig() }),
    ).not.toThrow();
  });
});

describe('loadConfig across worktrees', () => {
  const missingUserConfig = () => join(root, 'absent', 'config.json');

  const inLinkedWorktree = (cwd = join(root, 'repo-alpha')) =>
    loadConfig({
      cwd,
      repositoryRoot: join(root, 'repo'),
      worktreeRoot: join(root, 'repo-alpha'),
      userConfigPath: missingUserConfig(),
    });

  beforeEach(() => {
    mkdirSync(join(root, 'repo-alpha', 'src'), { recursive: true });
  });

  it('applies the main checkout config inside a linked worktree', () => {
    write('repo/claude-bit.json', { command: 'claude-project' });

    expect(inLinkedWorktree().config.command).toBe('claude-project');
  });

  it('lets a config inside the worktree override the repository one', () => {
    write('repo/claude-bit.json', { command: 'claude-project', color: 'never' });
    write('repo-alpha/claude-bit.json', { command: 'claude-local' });

    const { config } = inLinkedWorktree();

    expect(config.command).toBe('claude-local');
    expect(config.color).toBe('never');
  });

  it('finds the worktree config from a nested directory', () => {
    write('repo-alpha/claude-bit.json', { command: 'claude-local' });

    expect(inLinkedWorktree(join(root, 'repo-alpha', 'src')).config.command).toBe('claude-local');
  });

  it('does not reach past the worktree into an unrelated parent', () => {
    write('claude-bit.json', { command: 'claude-stray' });

    expect(inLinkedWorktree().config.command).toBe('claude');
  });

  it('counts the repository config once when it is also the nearest one', () => {
    write('repo/claude-bit.json', { command: 'claude-project' });

    const { sources } = loadConfig({
      cwd: join(root, 'repo'),
      repositoryRoot: join(root, 'repo'),
      worktreeRoot: join(root, 'repo'),
      userConfigPath: missingUserConfig(),
    });

    expect(sources).toHaveLength(1);
  });
});
