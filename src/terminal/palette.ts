import ansis, { Ansis } from 'ansis';

import { ColorChannel } from './colorChannel.ts';
import type { SessionColor } from './sessionColor.ts';

const COLOR_OFF = 0;
const TRUECOLOR = 3;

export type Paint = (value: string) => string;

export type Palette = {
  action: Paint;
  danger: Paint;
  muted: Paint;
  strong: Paint;
  error: Paint;
  session: (color: SessionColor) => Paint;
};

export type PaletteOptions = {
  supported?: boolean;
};

const colorsFor = (supported: boolean | undefined) =>
  supported === undefined ? ansis : new Ansis(supported ? TRUECOLOR : COLOR_OFF);

export const createPalette = ({ supported }: PaletteOptions = {}): Palette => {
  const colors = colorsFor(supported);

  const session = (color: SessionColor): Paint =>
    colors.rgb(color[ColorChannel.Red], color[ColorChannel.Green], color[ColorChannel.Blue]);

  return {
    action: (value) => colors.bold(colors.cyanBright(value)),
    danger: (value) => colors.bold(colors.redBright(value)),
    muted: colors.dim,
    strong: colors.bold,
    error: colors.red,
    session,
  };
};
