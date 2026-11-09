# Architecture

Why the code is shaped the way it is. Source files carry no comments by
[convention](conventions.md), so the reasoning lives here.

## The shape

One invocation is a straight line:

```
cli.ts              read the process: argv, cwd, whether both ends are a terminal
  app.ts            find the repository, load config, choose a worktree
    chooseTarget.ts ask until the answer is a worktree
      picker.ts     all the prompting; one Choice comes back
    plan.ts         turn that choice into the exact command to run
  launcher.ts       spawn it, mirror its exit status
```

Everything above `launcher.ts` is a decision. `resolveLaunch` returns a `Launch`
— a command, arguments, a working directory, a title — and spawns nothing. The
one function that touches the process table does no deciding.

This is what makes the behaviour that actually matters testable. Which flags
Claude receives, and in what order, is checked by asserting on a plain object,
not by running the real binary and reading its output.

## Choosing is a loop, because removing is not an answer

`picker.ts` owns the prompting — the list, and the two prompts behind the remove entry — and
however many questions it asks, it answers with a single `Choice`: either a worktree to launch in
or a set of worktrees to remove. Removing is not somewhere Claude can run, so it cannot end the
flow: `chooseTarget` performs the removal and asks again, with a repository re-read from git so
the list no longer shows what is gone. The loop ends the only two ways it can — a worktree to
launch in, or a cancellation.

Escape still means **quit**, at every prompt, as it already did in the name prompt behind the
create entry. Backing out of a removal is a different gesture: select nothing, or answer no, and
the loop comes round again having changed nothing.

That split is also why the picker never runs git itself. It renders choices and reads keys;
`chooseTarget` owns the one mutation this program makes, and `app.ts` injects it as `choose`, so
the loop is covered by tests that fake the prompt and the git runner.

Two worktrees are never offered for removal, and the reason is not politeness:

- the **main checkout** — `git worktree remove` refuses it outright;
- the **enclosing worktree** — git would happily delete the directory the user is standing in.

In a bare layout there is no main checkout, so only the second rule applies and `proj/main` is as
removable as any other worktree. That is git's own model, not an oversight: `main` there is an
ordinary linked worktree, and removing it leaves the repository working, because `root` is derived
from the worktree list on the next read rather than remembered.

A refusal is not fatal. `git worktree remove` fails per worktree — most often because the tree
still holds uncommitted or untracked changes — so `removeWorktrees` removes what it can, collects
the rest, and the loop hands git's own wording back to the picker as a notice above the next
question. Nothing else in this program turns a git failure into a message the user can act on;
here the user is mid-task and a crash would lose the session they were about to start.

## Dependency injection, and where it stops

`resolveLaunch` takes a `Dependencies` object defaulted to the real
implementations: the git runner, the config loader, the session lookup, the
picker. Tests pass fakes. Nothing needs a real repository on disk, and the
picker never opens during a test run.

Injection stops at the boundary. Inside `plan.ts` there is nothing to inject,
because it is pure: data in, data out.

`chooseTarget` is the one decision that also writes: removing a worktree changes the repository.
It takes the git runner it was given rather than reaching for one, and defaults its prompt to the
real picker, so a test drives the whole loop — removals, refusals, re-reads — without a terminal
and against a fake repository.

## Repository identity vs. repository root

`Repository` carries two paths that are the same directory in the common case
and different in the one that matters:

| Field       | Meaning                                                 |
| ----------- | ------------------------------------------------------- |
| `directory` | What identifies the repository. Supplies `{repo}`.      |
| `root`      | A real worktree, somewhere `claude --worktree` can run. |

In the usual layout (`proj/.git`) both are `proj`. In the bare layout
(`proj/.bare` beside `proj/main`, `proj/feat-x`) `directory` is `proj` — which
is **not a worktree at all** — while `root` is one of the real checkouts.

Collapsing these into one field is the bug this split exists to prevent. The
original code derived a single `mainCheckout` from `dirname(git-common-dir)`,
which silently produced a non-worktree for the bare layout: nothing was ever
marked as the main checkout, and new worktrees would have been created from a
directory outside any repository.

A bare layout genuinely has no main checkout, and the code says so — no
worktree reports `isMainCheckout`, and the picker simply does not label one.
The bare entry itself is filtered out of `worktrees`: it has no working tree,
so it is not somewhere a session can run.

## Configuration layering

Four layers, lowest first: defaults, user file, main checkout, nearest file
above the working directory.

The main checkout is a layer of its own because configuration belongs to the
repository, and a linked worktree lives **outside** the main checkout — walking
up from `proj-feat-x` never reaches `proj`. Without that layer, a repo's config
is invisible from every worktree except the original one.

The upward search is bounded by the enclosing worktree so it cannot wander into
unrelated parent directories and pick up a stranger's config.

In a bare layout there is no main checkout, so that layer is absent and each
worktree's own committed config applies — which is the right answer, since each
worktree has its own checkout of the file.

Each file is validated **on its own** before the layers are merged. Validating
only the merged result reports every problem against the highest-precedence
file, which may not even mention the offending key.

Objects merge key by key so a project states only what it changes. Arrays
replace wholesale: a list like `args` is a complete statement of intent, not
something to append to.

## When the picker is skipped

Three independent reasons, all in `resolveLaunch`:

- **Not a terminal.** Both stdin and stdout must be a TTY. Checking stdin alone
  is wrong: the picker reads keys from stdin but _draws on stdout_, so
  `claude-bit > out.log` would render the prompt into the file and look like a
  hang.
- **Turned off** in config.
- **Argv already names a session** — `--resume`, `--continue`, `-p`, `-w` and
  friends. These also suppress the automatic `--continue`, because such a flag
  is Claude's own answer to the same question and the wrapper must not
  second-guess it.

## Argument order

`plan.ts` assembles arguments as: configured `args`, then target-specific flags
(`--continue`, or `--worktree <name>`), then `--name`, then whatever the user
typed. The user's arguments come last so they win — `claude-bit --name mine`
overrides the generated session name.

## Title rendering

Two mechanisms, because two things want to own the window title:

- `claude-bit` writes an OSC sequence before handing off — what you see while
  Claude starts.
- `--name` tells Claude Code what the session is called, which it shows in its
  prompt box, in `/resume`, and in the title it maintains afterwards.

Templates must survive missing values: a detached worktree has no branch. A
token with no value disappears **along with the separator beside it**, so the
result is `api`, never `api · `.

## Parsing git

`porcelain.ts` is pure translation: bytes git printed, in, plain data out. It
knows nothing about running git or about choosing a worktree. `repository.ts`
runs git and applies meaning.

Two details the parser exists to get right:

- An unborn branch reports `HEAD` as the null object id (all zeros). It is not
  a commit, and `git show` on it is fatal, so it is normalised to empty.
- The bare repository appears in `git worktree list --porcelain` as a block
  carrying a `bare` marker and no `HEAD`.

Commit details are decoration — they make the picker readable, but nothing
depends on them. So `readCommitSummaries` is best-effort: a repository git
cannot describe still works, just without the relative timestamps.
