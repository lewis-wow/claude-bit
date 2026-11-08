import { basename } from 'node:path';

import type { Worktree } from '../git/repository.ts';
import type { Palette } from '../terminal/palette.ts';

const DETAIL_SEPARATOR = ' · ';

export const worktreeDetails = (worktree: Worktree): string[] =>
  [
    worktree.branch ?? 'detached',
    worktree.commit?.relative,
    worktree.isMainCheckout ? 'main checkout' : undefined,
  ].filter((detail) => detail !== undefined);

export const worktreeLabel = (worktree: Worktree, palette: Palette): string => {
  const details = worktreeDetails(worktree);
  const name = worktree.isMainCheckout ? palette.strong(basename(worktree.path)) : basename(worktree.path);

  return details.length === 0 ? name : `${name}  ${palette.muted(details.join(DETAIL_SEPARATOR))}`;
};
