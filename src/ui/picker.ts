import { confirm, isCancel, log, multiselect, select, text } from '@clack/prompts';

import type { LaunchTarget } from '../claude/plan.ts';
import { TargetKind } from '../claude/targetKind.ts';
import type { Config } from '../config/schema.ts';
import { findEnclosingWorktree, removableWorktrees } from '../git/repository.ts';
import type { Repository, Worktree } from '../git/repository.ts';
import type { Palette } from '../terminal/palette.ts';
import { ChoiceKind } from './choiceKind.ts';
import { removalQuestion, worktreeLabel } from './labels.ts';

const CREATE_NEW_WORKTREE = Symbol('create-new-worktree');
const REMOVE_WORKTREES = Symbol('remove-worktrees');

type Entry = string | typeof CREATE_NEW_WORKTREE | typeof REMOVE_WORKTREES;

export type Choice =
  | { kind: typeof ChoiceKind.Launch; target: LaunchTarget }
  | { kind: typeof ChoiceKind.Removal; paths: readonly string[] };

type PickTargetOptions = {
  repository: Repository;
  config: Config;
  palette: Palette;
  cwd: string;
  notices?: readonly string[];
};

const NOTHING_REMOVED: Choice = { kind: ChoiceKind.Removal, paths: [] };

const launchChoice = (target: LaunchTarget): Choice => ({ kind: ChoiceKind.Launch, target });

const repositoryItself = (repository: Repository): Choice =>
  launchChoice({
    kind: TargetKind.Existing,
    path: repository.root,
    branch: undefined,
    hasStoredSession: false,
  });

const toTarget = (worktree: Worktree): LaunchTarget => ({
  kind: TargetKind.Existing,
  path: worktree.path,
  branch: worktree.branch,
  hasStoredSession: false,
});

const promptForNewWorktree = async (config: Config): Promise<Choice | undefined> => {
  const name = await text({
    message: 'New worktree name',
    placeholder: config.worktree.namePlaceholder,
    validate: (value) => ((value ?? '').trim().length === 0 ? 'Name is required' : undefined),
  });

  return isCancel(name) ? undefined : launchChoice({ kind: TargetKind.New, name: name.trim() });
};

const promptForRemoval = async (
  removable: readonly Worktree[],
  { config, palette }: Pick<PickTargetOptions, 'config' | 'palette'>,
): Promise<Choice | undefined> => {
  const selection = await multiselect<string>({
    message: config.picker.removeMessage,
    maxItems: config.picker.maxItems,
    required: false,
    options: removable.map((worktree) => ({
      value: worktree.path,
      label: worktreeLabel(worktree, palette),
    })),
  });

  if (isCancel(selection)) {
    return undefined;
  }

  const chosen = removable.filter((worktree) => selection.includes(worktree.path));

  if (chosen.length === 0) {
    return NOTHING_REMOVED;
  }

  const confirmed = await confirm({
    message: removalQuestion(chosen, config.worktree.forceRemove),
    initialValue: false,
  });

  if (isCancel(confirmed)) {
    return undefined;
  }

  return confirmed
    ? { kind: ChoiceKind.Removal, paths: chosen.map((worktree) => worktree.path) }
    : NOTHING_REMOVED;
};

type RemovalEntry = { value: typeof REMOVE_WORKTREES; label: string };

const removalEntry = (
  removable: readonly Worktree[],
  { config, palette }: PickTargetOptions,
): RemovalEntry[] => {
  const label = config.picker.removeWorktreeLabel;

  return label === null || removable.length === 0
    ? []
    : [{ value: REMOVE_WORKTREES, label: palette.error(label) }];
};

export const pickTarget = async (options: PickTargetOptions): Promise<Choice | undefined> => {
  const { repository, config, palette, cwd, notices = [] } = options;
  const [first, ...rest] = repository.worktrees;

  for (const notice of notices) log.error(notice);

  if (first === undefined) {
    return repositoryItself(repository);
  }

  const removable = removableWorktrees(repository.worktrees, cwd);

  const selection = await select<Entry>({
    message: config.picker.message,
    maxItems: config.picker.maxItems,
    initialValue: findEnclosingWorktree(repository.worktrees, cwd)?.path ?? first.path,
    options: [
      { value: first.path, label: worktreeLabel(first, palette) },
      { value: CREATE_NEW_WORKTREE, label: palette.accent(config.picker.createWorktreeLabel) },
      ...rest.map((worktree) => ({
        value: worktree.path,
        label: worktreeLabel(worktree, palette),
      })),
      ...removalEntry(removable, options),
    ],
  });

  if (isCancel(selection)) {
    return undefined;
  }

  if (selection === CREATE_NEW_WORKTREE) {
    return promptForNewWorktree(config);
  }

  if (selection === REMOVE_WORKTREES) {
    return promptForRemoval(removable, options);
  }

  const chosen = repository.worktrees.find((worktree) => worktree.path === selection);

  if (chosen === undefined) {
    throw new Error(`Selected worktree is no longer listed: ${selection}`);
  }

  return launchChoice(toTarget(chosen));
};
