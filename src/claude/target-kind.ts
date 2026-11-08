export const TargetKind = {
  Existing: 'existing',
  New: 'new',
} as const;

export type TargetKind = (typeof TargetKind)[keyof typeof TargetKind];
