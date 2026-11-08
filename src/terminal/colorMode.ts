export const ColorMode = {
  Auto: 'auto',
  Always: 'always',
  Never: 'never',
} as const;

export type ColorMode = (typeof ColorMode)[keyof typeof ColorMode];
