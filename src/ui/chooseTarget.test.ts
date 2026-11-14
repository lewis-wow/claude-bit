import { describe, expect, it, vi } from 'vitest';

import { TargetKind } from '../claude/targetKind.ts';
import { COMMIT_FIELD_SEPARATOR } from '../git/porcelain.ts';
import { openRepository } from '../git/repository.ts';
import { ChoiceKind } from './choiceKind.ts';
import { chooseTarget } from './chooseTarget.ts';
import type { Choice } from './picker.ts';

const MAIN_ONLY = 'worktree /repo\nHEAD aaa\nbranch refs/heads/main\n';

const WORKTREE_LIST = [MAIN_ONLY, 'worktree /repo-wt/api\nHEAD bbb\nbranch refs/heads/feat/api\n'].join('\n');

const COMMITS = [
  ['aaa', '200', '1 hour ago'].join(COMMIT_FIELD_SEPARATOR),
  ['bbb', '100', '3 days ago'].join(COMMIT_FIELD_SEPARATOR),
].join('\n');

const REFUSED = "fatal: '/repo-wt/api' contains modified or untracked files, use --force to delete it";

const gitServingListings = (listings: readonly string[]) => {
  const pending = [...listings];

  return vi.fn((args: string[]) => {
    if (args[0] === 'rev-parse') return '/repo/.git';
    if (args[0] === 'worktree' && args[1] === 'list')
      return pending.length > 1 ? pending.shift()! : pending[0]!;
    if (args[0] === 'worktree') return '';
    if (args[0] === 'show') return COMMITS;

    throw new Error(`unexpected git invocation: ${args.join(' ')}`);
  });
};

const gitRefusingRemoval = () =>
  vi.fn((args: string[]) => {
    if (args[0] === 'rev-parse') return '/repo/.git';
    if (args[0] === 'worktree' && args[1] === 'list') return WORKTREE_LIST;
    if (args[0] === 'show') return COMMITS;

    throw new Error(`Command failed: git ${args.join(' ')}\n${REFUSED}\n`);
  });

const launchChoice: Choice = {
  kind: ChoiceKind.Launch,
  target: { kind: TargetKind.Existing, path: '/repo', branch: 'main', hasStoredSession: false },
};

const removalChoice = (paths: string[]): Choice => ({ kind: ChoiceKind.Removal, paths });

const picking = (...choices: (Choice | undefined)[]) => {
  const pick = vi.fn();

  for (const choice of choices) pick.mockResolvedValueOnce(choice);

  return pick;
};

const choose = (git: ReturnType<typeof gitServingListings>, pick: ReturnType<typeof picking>) => {
  const repository = openRepository({ git, cwd: '/repo' })!;

  return chooseTarget({ repository, cwd: '/repo', git, pick });
};

describe('chooseTarget', () => {
  it('launches what the picker chose', async () => {
    const pick = picking(launchChoice);

    expect(await choose(gitServingListings([WORKTREE_LIST]), pick)).toEqual(launchChoice.target);
    expect(pick).toHaveBeenCalledOnce();
  });

  it('cancels when the picker is dismissed', async () => {
    expect(await choose(gitServingListings([WORKTREE_LIST]), picking(undefined))).toBeUndefined();
  });

  it('removes the chosen worktrees, then asks again where to run', async () => {
    const git = gitServingListings([WORKTREE_LIST]);
    const pick = picking(removalChoice(['/repo-wt/api']), launchChoice);

    expect(await choose(git, pick)).toEqual(launchChoice.target);
    expect(git).toHaveBeenCalledWith(['worktree', 'remove', '/repo-wt/api'], { cwd: '/repo' });
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('shows the picker the worktrees that are left', async () => {
    const pick = picking(removalChoice(['/repo-wt/api']), launchChoice);
    await choose(gitServingListings([WORKTREE_LIST, MAIN_ONLY]), pick);

    expect(pick.mock.calls[0]?.[0].repository.worktrees).toHaveLength(2);
    expect(pick.mock.calls[1]?.[0].repository.worktrees).toHaveLength(1);
  });

  it('tells the picker what git refused to remove', async () => {
    const pick = picking(removalChoice(['/repo-wt/api']), launchChoice);
    await choose(gitRefusingRemoval(), pick);

    expect(pick.mock.calls[0]?.[0].notices).toEqual([]);
    expect(pick.mock.calls[1]?.[0].notices).toEqual([`api: ${REFUSED}`]);
  });

  it('removes nothing when the removal prompt comes back empty', async () => {
    const git = gitServingListings([WORKTREE_LIST]);
    await choose(git, picking(removalChoice([]), launchChoice));

    expect(git.mock.calls.map(([args]) => args)).not.toContainEqual(expect.arrayContaining(['remove']));
  });
});
