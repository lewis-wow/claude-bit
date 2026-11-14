import type { Writable } from 'node:stream';

import { COLOR_CHANNELS } from './colorChannel.ts';
import { BEL, OSC } from './controlCharacters.ts';
import type { SessionColor } from './sessionColor.ts';

const SET_CURSOR_COLOR = '12';
const RESET_CURSOR_COLOR = '112';

const HEX_DIGITS = 16;
const CHANNEL_DIGITS = 2;

const channelDigits = (value: number) => value.toString(HEX_DIGITS).padStart(CHANNEL_DIGITS, '0');

const specification = (color: SessionColor) =>
  `rgb:${COLOR_CHANNELS.map((channel) => channelDigits(color[channel])).join('/')}`;

export const cursorColorSequence = (color: SessionColor): string =>
  `${OSC}${SET_CURSOR_COLOR};${specification(color)}${BEL}`;

export const defaultCursorColorSequence = (): string => `${OSC}${RESET_CURSOR_COLOR}${BEL}`;

type TerminalStream = Writable & { isTTY?: boolean };

const write = (sequence: string, stream: TerminalStream) => {
  if (!stream.isTTY) {
    return false;
  }

  stream.write(sequence);

  return true;
};

export const setTerminalCursorColor = (color: SessionColor, stream: TerminalStream): boolean =>
  write(cursorColorSequence(color), stream);

export const resetTerminalCursorColor = (stream: TerminalStream): boolean =>
  write(defaultCursorColorSequence(), stream);
