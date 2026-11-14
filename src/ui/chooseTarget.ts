import type { LaunchTarget } from '../claude/plan.ts';
import type { GitRunner } from '../git/git.ts';
import { removeWorktrees } from '../git/removeWorktrees.ts';
import { openRepository } from '../git/repository.ts';
import type { Repository } from '../git/repository.ts';
import { createPalette } from '../terminal/palette.ts';
import { ChoiceKind } from './choiceKind.ts';
import { removalFailureNotice } from './labels.ts';
import { pickTarget } from './picker.ts';

export type ChooseTargetOptions = {
  repository: Repository;
  cwd: string;
  git: GitRunner;
  pick?: typeof pickTarget;
  notices?: readonly string[];
};

export const chooseTarget = async (options: ChooseTargetOptions): Promise<LaunchTarget | undefined> => {
  const { repository, cwd, git, pick = pickTarget, notices = [] } = options;

  const palette = createPalette();

  const choice = await pick({ repository, palette, cwd, notices });

  if (choice === undefined) {
    return undefined;
  }

  if (choice.kind === ChoiceKind.Launch) {
    return choice.target;
  }

  if (choice.paths.length === 0) {
    return chooseTarget({ ...options, notices: [] });
  }

  const failures = removeWorktrees({ git, cwd, paths: choice.paths });

  return chooseTarget({
    ...options,
    repository: openRepository({ git, cwd }) ?? repository,
    notices: failures.map(removalFailureNotice),
  });
};
