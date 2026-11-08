export const COMMIT_FIELD_SEPARATOR = '\0';

export const COMMIT_FORMAT = ['%H', '%ct', '%cr'].join('%x00');

const BRANCH_REF_PREFIX = 'refs/heads/';
const NULL_OBJECT_ID = /^0+$/u;

export type WorktreeRecord = {
  path: string;
  head: string;
  branch: string | undefined;
  isBare: boolean;
};

export type CommitSummary = {
  committedAt: number;
  relative: string;
};

const splitField = (line: string): [string, string] => {
  const separatorIndex = line.indexOf(' ');

  return separatorIndex === -1 ? [line, ''] : [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
};

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
        isBare: fields.has('bare'),
      },
    ];
  });

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
