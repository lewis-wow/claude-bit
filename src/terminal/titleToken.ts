export const TitleToken = {
  Worktree: 'worktree',
  Branch: 'branch',
  Repo: 'repo',
  Path: 'path',
} as const;

export type TitleToken = (typeof TitleToken)[keyof typeof TitleToken];

export const TITLE_TOKENS: readonly TitleToken[] = Object.values(TitleToken);
