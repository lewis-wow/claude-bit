import { confirm, isCancel, log, multiselect, note, select, text } from '@clack/prompts';

import type { LaunchTarget } from '../claude/plan.ts';
import { TargetKind } from '../claude/targetKind.ts';
import { findEnclosingWorktree, removableWorktrees } from '../git/repository.ts';
import type { Repository, Worktree } from '../git/repository.ts';
import type { Palette } from '../terminal/palette.ts';
import { ChoiceKind } from './choiceKind.ts';
import { changeTypeCatalogue, removalQuestion, worktreeLabel, worktreeNameRequirement } from './labels.ts';

const PICK_MESSAGE = 'Where should Claude run?';
const REMOVE_MESSAGE = 'Which worktrees should be removed?';
const CREATE_LABEL = '+  Create new worktree…';
const CREATE_HINT = 'asks for a name';
const REMOVE_LABEL = '×  Remove worktrees…';
const REMOVE_HINT = 'asks which, then confirms';
const CHANGE_TYPE_TITLE = 'Name it after what it changes';
const NEW_WORKTREE_MESSAGE = 'New worktree name';
const NEW_WORKTREE_PLACEHOLDER = 'feat/retry-logic';
const MAX_ITEMS = 12;

const CREATE_NEW_WORKTREE = Symbol('create-new-worktree');
const REMOVE_WORKTREES = Symbol('remove-worktrees');

type Entry = string | typeof CREATE_NEW_WORKTREE | typeof REMOVE_WORKTREES;

export type Choice =
  | { kind: typeof ChoiceKind.Launch; target: LaunchTarget }
  | { kind: typeof ChoiceKind.Removal; paths: readonly string[] };

type PickTargetOptions = {
  repository: Repository;
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

const promptForNewWorktree = async (palette: Palette): Promise<Choice | undefined> => {
  note(changeTypeCatalogue(palette), CHANGE_TYPE_TITLE);

  const name = await text({
    message: NEW_WORKTREE_MESSAGE,
    placeholder: NEW_WORKTREE_PLACEHOLDER,
    validate: worktreeNameRequirement,
  });

  return isCancel(name) ? undefined : launchChoice({ kind: TargetKind.New, name: name.trim() });
};

const promptForRemoval = async (
  removable: readonly Worktree[],
  palette: Palette,
): Promise<Choice | undefined> => {
  const selection = await multiselect<string>({
    message: REMOVE_MESSAGE,
    maxItems: MAX_ITEMS,
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
    message: removalQuestion(chosen),
    initialValue: false,
  });

  if (isCancel(confirmed)) {
    return undefined;
  }

  return confirmed
    ? { kind: ChoiceKind.Removal, paths: chosen.map((worktree) => worktree.path) }
    : NOTHING_REMOVED;
};

type Option = { value: Entry; label: string; hint?: string };

const removalEntry = (removable: readonly Worktree[], palette: Palette): Option[] =>
  removable.length === 0
    ? []
    : [{ value: REMOVE_WORKTREES, label: palette.danger(REMOVE_LABEL), hint: REMOVE_HINT }];

const entries = (
  [first, ...rest]: readonly Worktree[],
  removable: readonly Worktree[],
  palette: Palette,
): Option[] => [
  ...(first === undefined ? [] : [{ value: first.path, label: worktreeLabel(first, palette) }]),
  { value: CREATE_NEW_WORKTREE, label: palette.action(CREATE_LABEL), hint: CREATE_HINT },
  ...rest.map((worktree) => ({ value: worktree.path, label: worktreeLabel(worktree, palette) })),
  ...removalEntry(removable, palette),
];

export const pickTarget = async ({
  repository,
  palette,
  cwd,
  notices = [],
}: PickTargetOptions): Promise<Choice | undefined> => {
  const [first] = repository.worktrees;

  for (const notice of notices) log.error(notice);

  if (first === undefined) {
    return repositoryItself(repository);
  }

  const removable = removableWorktrees(repository.worktrees, cwd);

  const selection = await select<Entry>({
    message: PICK_MESSAGE,
    maxItems: MAX_ITEMS,
    initialValue: findEnclosingWorktree(repository.worktrees, cwd)?.path ?? first.path,
    options: entries(repository.worktrees, removable, palette),
  });

  if (isCancel(selection)) {
    return undefined;
  }

  if (selection === CREATE_NEW_WORKTREE) {
    return promptForNewWorktree(palette);
  }

  if (selection === REMOVE_WORKTREES) {
    return promptForRemoval(removable, palette);
  }

  const chosen = repository.worktrees.find((worktree) => worktree.path === selection);

  if (chosen === undefined) {
    throw new Error(`Selected worktree is no longer listed: ${selection}`);
  }

  return launchChoice(toTarget(chosen));
};
