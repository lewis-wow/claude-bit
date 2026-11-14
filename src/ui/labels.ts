import { basename } from 'node:path';

import { CHANGE_TYPES, ChangeType } from '../changeType.ts';
import type { Worktree } from '../git/repository.ts';
import type { Palette } from '../terminal/palette.ts';
import { sessionColorFor } from '../terminal/sessionColor.ts';
import type { SessionColor } from '../terminal/sessionColor.ts';

const DETAIL_SEPARATOR = ' · ';

const UNTYPED_LABEL = 'anything else';
const UNTYPED_SUMMARY = 'a name of your own, in a quieter colour of its own';

const CHANGE_TYPE_WIDTH = Math.max(
  UNTYPED_LABEL.length,
  ...Object.values(ChangeType).map((type) => type.length),
);

const CHANGE_TYPE_SUMMARY: Record<ChangeType, string> = {
  [ChangeType.Feat]: 'a new capability',
  [ChangeType.Fix]: 'a defect, repaired',
  [ChangeType.Refactor]: 'same behaviour, written better',
  [ChangeType.Test]: 'tests only',
  [ChangeType.Docs]: 'documentation only',
  [ChangeType.Chore]: 'upkeep — dependencies, tooling, housekeeping',
  [ChangeType.Perf]: 'same behaviour, faster',
  [ChangeType.Ci]: 'pipelines, workflows, releases',
};

export const worktreeName = (path: string): string => basename(path);

const catalogueLine = (name: string, summary: string, color: SessionColor, palette: Palette) =>
  `${palette.session(color)(name.padEnd(CHANGE_TYPE_WIDTH))}  ${palette.muted(summary)}`;

export const changeTypeCatalogue = (palette: Palette): string =>
  [
    ...CHANGE_TYPES.map((type) =>
      catalogueLine(type, CHANGE_TYPE_SUMMARY[type], sessionColorFor(type, type), palette),
    ),
    catalogueLine(UNTYPED_LABEL, UNTYPED_SUMMARY, sessionColorFor(UNTYPED_LABEL, undefined), palette),
  ].join('\n');

const NAME_REQUIRED = 'Name is required';

export const worktreeNameRequirement = (name: string | undefined): string | undefined =>
  (name ?? '').trim().length === 0 ? NAME_REQUIRED : undefined;

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

export const removalQuestion = (worktrees: readonly Worktree[]): string => {
  const [only] = worktrees;

  if (worktrees.length === 1 && only !== undefined) {
    return `Remove ${worktreeName(only.path)}? Its directory goes, its branch stays.`;
  }

  return `Remove ${worktrees.length} worktrees? Their directories go, their branches stay.`;
};

export const removalFailureNotice = ({ path, reason }: { path: string; reason: string }): string =>
  `${worktreeName(path)}: ${reason}`;
