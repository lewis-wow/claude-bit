import { isCancel, select, text } from '@clack/prompts';

import type { LaunchTarget } from '../claude/plan.ts';
import type { Config } from '../config/schema.ts';
import { findEnclosingWorktree } from '../git/repository.ts';
import type { Repository, Worktree } from '../git/repository.ts';
import type { Palette } from '../terminal/palette.ts';
import { worktreeLabel } from './labels.ts';

/**
 * The interactive worktree chooser.
 *
 * It answers one question — which worktree should Claude run in — and returns
 * a `LaunchTarget`. Cancelling returns `undefined`; deciding what that means
 * for the process is the caller's job.
 */

/** Sentinel used as the value of the "create a worktree" entry. */
const CREATE_NEW_WORKTREE = Symbol('create-new-worktree');

type PickTargetOptions = {
  repository: Repository;
  config: Config;
  palette: Palette;
  cwd: string;
};

const toTarget = (worktree: Worktree): LaunchTarget => ({
  kind: 'existing',
  path: worktree.path,
  branch: worktree.branch,
  hasStoredSession: false,
});

export const pickTarget = async ({
  repository,
  config,
  palette,
  cwd,
}: PickTargetOptions): Promise<LaunchTarget | undefined> => {
  const [first, ...rest] = repository.worktrees;

  if (first === undefined) {
    return {
      kind: 'existing',
      path: repository.root,
      branch: undefined,
      hasStoredSession: false,
    };
  }

  const selection = await select<string | typeof CREATE_NEW_WORKTREE>({
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
    ],
  });

  if (isCancel(selection)) {
    return undefined;
  }

  if (selection !== CREATE_NEW_WORKTREE) {
    const chosen = repository.worktrees.find((worktree) => worktree.path === selection);

    // Every option was built from this list, so a miss means the two have
    // drifted apart. Reporting it as a cancellation would hide a real bug
    // behind the exit status of a deliberate Ctrl-C.
    if (chosen === undefined) {
      throw new Error(`Selected worktree is no longer listed: ${selection}`);
    }

    return toTarget(chosen);
  }

  const name = await text({
    message: 'New worktree name',
    placeholder: config.worktree.namePlaceholder,
    validate: (value) => ((value ?? '').trim().length === 0 ? 'Name is required' : undefined),
  });

  return isCancel(name) ? undefined : { kind: 'new', name: name.trim() };
};
