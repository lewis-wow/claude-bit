export const ColorChannel = {
  Red: 'red',
  Green: 'green',
  Blue: 'blue',
} as const;

export type ColorChannel = (typeof ColorChannel)[keyof typeof ColorChannel];

export const COLOR_CHANNELS: readonly ColorChannel[] = Object.values(ColorChannel);
