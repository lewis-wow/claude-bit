export const ChoiceKind = {
  Launch: 'launch',
  Removal: 'removal',
} as const;

export type ChoiceKind = (typeof ChoiceKind)[keyof typeof ChoiceKind];
