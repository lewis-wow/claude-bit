import type { Writable } from 'node:stream';

import { TITLE_TOKENS } from './titleToken.ts';
import type { TitleToken } from './titleToken.ts';

export type TitleTokens = Partial<Record<TitleToken, string | undefined>>;

const TOKEN_PATTERN = /\{(\w+)\}/gu;
const SEPARATORS = '·|';
const ORPHANED_SEPARATOR = new RegExp(`\\s*[${SEPARATORS}]\\s*(?=[${SEPARATORS}])`, 'gu');
const EDGE_SEPARATORS = new RegExp(`^[\\s${SEPARATORS}]+|[\\s${SEPARATORS}]+$`, 'gu');

const isTitleToken = (name: string): name is TitleToken => (TITLE_TOKENS as readonly string[]).includes(name);

const tidy = (value: string) =>
  value
    .replaceAll(/[^\S\n]+/gu, ' ')
    .replaceAll(ORPHANED_SEPARATOR, '')
    .replaceAll(EDGE_SEPARATORS, '');

export const renderTitleTemplate = (template: string, tokens: TitleTokens): string =>
  tidy(
    template.replaceAll(TOKEN_PATTERN, (match, name: string) =>
      isTitleToken(name) ? (tokens[name] ?? '') : match,
    ),
  );

const OSC = '\u001B]';
const BEL = '\u0007';

const sanitize = (title: string) => title.replaceAll(/\p{Cc}/gu, '').trim();

export const terminalTitleSequence = (title: string): string => `${OSC}0;${sanitize(title)}${BEL}`;

export const setTerminalTitle = (title: string, stream: Writable & { isTTY?: boolean }): boolean => {
  const sanitized = sanitize(title);

  if (!stream.isTTY || sanitized.length === 0) {
    return false;
  }

  stream.write(terminalTitleSequence(sanitized));

  return true;
};
