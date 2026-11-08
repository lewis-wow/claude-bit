/**
 * Parsers for the machine-readable git output this tool consumes.
 *
 * Everything here is pure: it turns bytes that git printed into plain data,
 * and knows nothing about running git or about worktree selection.
 */

/** NUL separates fields in our `git show` format so no field can be ambiguous. */
export const COMMIT_FIELD_SEPARATOR = '\0';

/** The `--format` string that `parseCommitSummaries` expects to receive. */
export const COMMIT_FORMAT = ['%H', '%ct', '%cr'].join('%x00');

const BRANCH_REF_PREFIX = 'refs/heads/';
/** Git reports an unborn branch's HEAD as all zeros; there is no commit to look up. */
const NULL_OBJECT_ID = /^0+$/u;

export type WorktreeRecord = {
  /** Absolute path of the worktree's working directory. */
  path: string;
  /** Commit the worktree is checked out at, or an empty string for a bare repository. */
  head: string;
  /** Short branch name, or `undefined` when the worktree is detached. */
  branch: string | undefined;
};

export type CommitSummary = {
  /** Commit date as a Unix timestamp in seconds — used for ordering. */
  committedAt: number;
  /** Human-readable age such as `2 days ago` — used for display. */
  relative: string;
};

/** Splits `key value` into its two halves, keeping spaces inside the value. */
const splitField = (line: string): [string, string] => {
  const separatorIndex = line.indexOf(' ');

  return separatorIndex === -1 ? [line, ''] : [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
};

/**
 * Parses the output of `git worktree list --porcelain`, which emits one
 * blank-line-separated block of `key value` lines per worktree.
 */
export const parseWorktreeList = (porcelain: string): WorktreeRecord[] =>
  porcelain.split('\n\n').flatMap((block) => {
    const fields = new Map(
      block
        .split('\n')
        .filter(Boolean)
        .map((line) => splitField(line)),
    );
    const path = fields.get('worktree');

    if (!path) {
      return [];
    }

    const branch = fields.get('branch');
    const head = fields.get('HEAD') ?? '';

    return [
      {
        path,
        head: NULL_OBJECT_ID.test(head) ? '' : head,
        branch: branch ? branch.replace(BRANCH_REF_PREFIX, '') : undefined,
      },
    ];
  });

/** Parses `git show -s --format=COMMIT_FORMAT <revs...>` into a lookup by revision. */
export const parseCommitSummaries = (output: string): Map<string, CommitSummary> =>
  new Map(
    output.split('\n').flatMap((line) => {
      const [revision, committedAt, relative] = line.split(COMMIT_FIELD_SEPARATOR);

      if (!revision || committedAt === undefined || relative === undefined) {
        return [];
      }

      return [[revision, { committedAt: Number(committedAt), relative }] as const];
    }),
  );
