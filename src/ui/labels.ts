import { basename } from 'node:path';

import type { Worktree } from '../git/repository.ts';
import type { Palette } from '../terminal/palette.ts';

const DETAIL_SEPARATOR = ' · ';

export const worktreeName = (path: string): string => basename(path);

export const worktreeDetails = (worktree: Worktree): string[] =>
  [
    worktree.branch ?? 'detached',
    worktree.commit?.relative,
    worktree.isMainCheckout ? 'main checkout' : undefined,
  ].filter((detail) => detail !== undefined);

export const worktreeLabel = (worktree: Worktree, palette: Palette): string => {
  const details = worktreeDetails(worktree);
  const plain = worktreeName(worktree.path);
  const name = worktree.isMainCheckout ? palette.strong(plain) : plain;

  return details.length === 0 ? name : `${name}  ${palette.muted(details.join(DETAIL_SEPARATOR))}`;
};

export const removalQuestion = (worktrees: readonly Worktree[], force: boolean): string => {
  const [only] = worktrees;

  if (worktrees.length === 1 && only !== undefined) {
    const loss = force ? 'Its directory and any uncommitted changes go' : 'Its directory goes';

    return `Remove ${worktreeName(only.path)}? ${loss}, its branch stays.`;
  }

  const loss = force ? 'Their directories and any uncommitted changes go' : 'Their directories go';

  return `Remove ${worktrees.length} worktrees? ${loss}, their branches stay.`;
};

export const removalFailureNotice = ({ path, reason }: { path: string; reason: string }): string =>
  `${worktreeName(path)}: ${reason}`;
