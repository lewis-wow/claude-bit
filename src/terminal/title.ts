import type { Writable } from 'node:stream';

import { TITLE_TOKENS } from '../config/schema.ts';

/**
 * Terminal window titles.
 *
 * Templates come from config, so rendering has to cope with values that are
 * missing — a detached worktree has no branch. A missing token disappears
 * along with the separator next to it instead of leaving a dangling `·`.
 */

export type TitleToken = (typeof TITLE_TOKENS)[number];
export type TitleTokens = Partial<Record<TitleToken, string | undefined>>;

const TOKEN_PATTERN = /\{(\w+)\}/gu;
/** Characters that only join two parts, and so are pointless on their own. */
const SEPARATORS = '·|';
/** A separator immediately followed by another one — the first has nothing to join. */
const ORPHANED_SEPARATOR = new RegExp(`\\s*[${SEPARATORS}]\\s*(?=[${SEPARATORS}])`, 'gu');
const EDGE_SEPARATORS = new RegExp(`^[\\s${SEPARATORS}]+|[\\s${SEPARATORS}]+$`, 'gu');

const isTitleToken = (name: string): name is TitleToken => (TITLE_TOKENS as readonly string[]).includes(name);

const tidy = (value: string) =>
  value
    .replaceAll(/[^\S\n]+/gu, ' ')
    .replaceAll(ORPHANED_SEPARATOR, '')
    .replaceAll(EDGE_SEPARATORS, '');

/**
 * Substitutes `{token}` placeholders. Known tokens without a value render as
 * nothing; unknown tokens are left alone so a typo stays visible.
 */
export const renderTitleTemplate = (template: string, tokens: TitleTokens): string =>
  tidy(
    template.replaceAll(TOKEN_PATTERN, (match, name: string) =>
      isTitleToken(name) ? (tokens[name] ?? '') : match,
    ),
  );

/** Control characters would corrupt the escape sequence that carries the title. */
const sanitize = (title: string) => title.replaceAll(/\p{Cc}/gu, '').trim();

/**
 * Builds the OSC 0 sequence that sets a terminal's window and icon title.
 * Terminals that do not understand it ignore it silently.
 */
export const terminalTitleSequence = (title: string): string => `]0;${sanitize(title)}`;

/** Writes the title to `stream`, doing nothing unless it is a terminal. */
export const setTerminalTitle = (title: string, stream: Writable & { isTTY?: boolean }): boolean => {
  const sanitized = sanitize(title);

  if (!stream.isTTY || sanitized.length === 0) {
    return false;
  }

  stream.write(terminalTitleSequence(sanitized));

  return true;
};
