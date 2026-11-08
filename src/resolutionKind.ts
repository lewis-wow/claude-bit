export const ResolutionKind = {
  Launch: 'launch',
  Cancelled: 'cancelled',
} as const;

export type ResolutionKind = (typeof ResolutionKind)[keyof typeof ResolutionKind];
