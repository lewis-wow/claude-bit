import type { Writable } from 'node:stream';

import { BEL, OSC } from './controlCharacters.ts';

const PART_SEPARATOR = ' · ';
const SET_TITLE = '0';

const isPresent = (part: string | undefined): part is string => part !== undefined && part.trim().length > 0;

export const composeTitle = (parts: readonly (string | undefined)[]): string =>
  parts.filter(isPresent).join(PART_SEPARATOR);

const sanitize = (title: string) => title.replaceAll(/\p{Cc}/gu, '').trim();

export const terminalTitleSequence = (title: string): string => `${OSC}${SET_TITLE};${sanitize(title)}${BEL}`;

export const setTerminalTitle = (title: string, stream: Writable & { isTTY?: boolean }): boolean => {
  const sanitized = sanitize(title);

  if (!stream.isTTY || sanitized.length === 0) {
    return false;
  }

  stream.write(terminalTitleSequence(sanitized));

  return true;
};
