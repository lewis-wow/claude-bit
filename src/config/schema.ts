import { z } from 'zod';

import { ColorMode } from '../terminal/color-mode.ts';
import { TITLE_TOKENS } from '../terminal/title-token.ts';

const TOKEN_LIST = TITLE_TOKENS.map((token) => `{${token}}`).join(' ');

const titleTemplate = (fallback: string, purpose: string) =>
  z.string().nullable().default(fallback).describe(`${purpose} Null disables it. Tokens: ${TOKEN_LIST}`);

const pickerSchema = z
  .strictObject({
    enabled: z.boolean().default(true).describe('Show the worktree picker on an interactive terminal.'),
    message: z.string().default('Where should Claude run?').describe('Prompt shown above the worktree list.'),
    maxItems: z.int().min(1).default(12).describe('Worktrees visible before the list scrolls.'),
    createWorktreeLabel: z
      .string()
      .default('+ Create new worktree…')
      .describe('Label of the entry that creates a new worktree.'),
    passthroughFlags: z
      .array(z.string())
      .default([
        '-c',
        '--continue',
        '-r',
        '--resume',
        '-p',
        '--print',
        '-h',
        '--help',
        '-v',
        '--version',
        '-w',
        '--worktree',
        '--from-pr',
      ])
      .describe('Arguments that mean the caller already chose a session, so the picker is skipped.'),
  })
  .prefault({});

const worktreeSchema = z
  .strictObject({
    namePlaceholder: z.string().default('feat/my-thing').describe('Placeholder shown in the name prompt.'),
    args: z
      .array(z.string())
      .default([])
      .describe('Extra arguments used only when creating a worktree, e.g. ["--tmux"].'),
  })
  .prefault({});

const terminalSchema = z
  .strictObject({
    title: titleTemplate('{worktree} · {branch}', 'Terminal window title set before Claude starts.'),
    sessionName: titleTemplate(
      '{worktree}',
      'Value passed to `claude --name`, which names the session and the title Claude maintains.',
    ),
  })
  .prefault({});

export const configSchema = z.strictObject({
  $schema: z.string().optional().describe('Path to schema.json, for editor completion.'),
  command: z.string().min(1).default('claude').describe('Executable this wrapper launches.'),
  args: z
    .array(z.string())
    .default(['--dangerously-skip-permissions'])
    .describe('Arguments added to every launch, before the ones you pass on the command line.'),
  resumeExistingSession: z
    .boolean()
    .default(true)
    .describe('Continue the stored session when the chosen worktree already has one.'),
  sessionsDirectory: z
    .string()
    .nullable()
    .default(null)
    .describe('Where Claude Code stores sessions. Null means ~/.claude/projects. A leading ~/ is expanded.'),
  color: z
    .enum(ColorMode)
    .default('auto')
    .describe('Colored output. "auto" follows TTY detection and NO_COLOR.'),
  picker: pickerSchema,
  worktree: worktreeSchema,
  terminal: terminalSchema,
});

export type Config = z.output<typeof configSchema>;
export type ConfigInput = z.input<typeof configSchema>;

export const defaultConfig = (): Config => configSchema.parse({});
