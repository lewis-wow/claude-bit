# Architecture

Why the code is shaped the way it is. Source files carry no comments by
[convention](conventions.md), so the reasoning lives here.

## The shape

One invocation is a straight line:

```
cli.ts              read the process: argv, cwd, whether both ends are a terminal
  app.ts            find the repository, choose a worktree
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
implementations: the git runner, the session lookup, the picker. Tests pass
fakes. Nothing needs a real repository on disk, and the picker never opens
during a test run.

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

## No configuration, and what replaced it

There was a config file once — `claude-bit.json`, four merge layers, a
generated JSON schema and a page hosting it. It is gone. The tool now has one
behaviour, and every former option is a named constant in the module that uses
it: the command and its base arguments in `claude/plan.ts`, the prompts in
`ui/picker.ts`, the colours in `terminal/sessionColor.ts`.

What that bought, beyond less code: there is no layering to reason about, no
file whose absence or staleness changes what runs, no schema that can drift
from the validator, and nothing to document except behaviour. A reader of
`plan.ts` can see the whole launch in one screen.

What it costs is real and deliberate. Two choices that used to be settable are
now fixed on the safer side:

- **Removal never passes `--force`.** Git refuses a worktree with uncommitted
  changes, and that refusal is reported rather than overridden; work is not
  thrown away on the tool's say-so.
- **`--dangerously-skip-permissions` is always passed**, because that is what
  this wrapper is for. Anything else the user wants goes on the command line,
  which is forwarded last and therefore wins.

The escape hatch for everything else is the same one the tool already relies
on: arguments are forwarded to `claude` untouched.

## When the picker is skipped

Two independent reasons, both in `resolveLaunch`:

- **Not a terminal.** Both stdin and stdout must be a TTY. Checking stdin alone
  is wrong: the picker reads keys from stdin but _draws on stdout_, so
  `claude-bit > out.log` would render the prompt into the file and look like a
  hang.
- **Argv already names a session** — `--resume`, `--continue`, `-p`, `-w` and
  friends. These also suppress the automatic `--continue`, because such a flag
  is Claude's own answer to the same question and the wrapper must not
  second-guess it.

## Argument order

`plan.ts` assembles arguments as: the base arguments, then target-specific flags
(`--continue`, or `--worktree <name>`), then `--name`, then whatever the user
typed. The user's arguments come last so they win — `claude-bit --name mine`
overrides the generated session name.

## Title rendering

Two mechanisms, because two things want to own the window title:

- `claude-bit` writes an OSC sequence before handing off — what you see while
  Claude starts.
- `--name` tells Claude Code what the session is called, which it shows in its
  prompt box, in `/resume`, and in the title it maintains afterwards.

The title must survive missing values: a detached worktree has no branch. A
part with no value disappears **along with the separator beside it**, so the
result is `api`, never `api · `.

## A colour per kind of work

The colour of a session is its **change type** — `feat`, `fix`, `refactor`,
`test`, `docs`, `chore`, `perf`, `ci` — and nothing else. Creating a worktree
asks for the type before the name, and the name it builds carries it:
`fix/retry-logic`. Reading a colour back is then parsing, not remembering.

This replaced a hash of the worktree name, and the replacement is a change of
meaning rather than of mechanism. A hash answered _which session is this_; two
features got two colours, and neither colour told you anything. The type
answers _what kind of work is this_, which is the question a wall of terminals
actually raises. The cost is that two features open at once are both green —
the colour no longer identifies a window, and the title is what does.

The type is an offer rather than a rule. The name is typed as it always was —
`fix/retry-logic`, one prompt, no list to arrow through — with the types
printed above that prompt, each in its own colour, so visibility costs nobody
a keystroke. A name that names no type is accepted; only an empty one is
refused. A wrapper that stood between its user and `git worktree add` to
enforce a naming policy would be answering a question nobody asked it.

Which is why free names are coloured too, rather than all sharing one grey.
Their hue is hashed from the name — the scheme this file used to describe for
every worktree — but at **0.3 saturation against a type's 0.8**. Vividness
carries the meaning: a type is vivid, a free name is quiet. Two signals in one
colour, and a free name cannot pass for `feat` at a glance even if its hue
lands nearby. Twelve quiet hues is not many, so two free names can share one;
the type colours, which carry meaning rather than identity, never collide.

The type is read from **the directory name or the branch**, whichever carries
it. Claude Code writes `feat/retry` to disk as `feat+retry`, and a worktree
added by hand might be `feat-retry`, so the separator set is `/ + - _ .` and a
bare `docs` counts too. Anything else — `main`, or a worktree from before this
existed — has no type and is grey, which reads as what it is: not a piece of
work in progress.

Hues are assigned so that neighbours in meaning are not neighbours on the
circle, and `fix` sits at 35° rather than 0°: red is the `error` role and the
removal entry, and a worktree that borrowed it would read as a warning.
Saturation and lightness are fixed at 0.8 and 0.72, which keeps the worst case
— `chore`, the most blue — at about 5.9:1 against `#1e1e1e`.

The colour is decided in `plan.ts` with everything else about the launch, and
carried on `Launch` beside the title: deciding and emitting stay apart, so what
a session is coloured is asserted on a plain object rather than by reading
bytes off a terminal.

Three places show it, and they answer three different questions:

| Where          | Which worktree       | Why that one                       |
| -------------- | -------------------- | ---------------------------------- |
| Picker entries | each listed worktree | see what is in flight at a glance  |
| Picker accent  | the enclosing one    | the session you are in right now   |
| The terminal   | the chosen one       | the session you are about to start |

Only the **cursor** is painted — `OSC 12` in, `OSC 112` back out. Earlier
versions also tinted the tab (iTerm2's `OSC 6`) and the terminal background
(`OSC 11`), and both were dropped: the tab is unreachable in VS Code, whose
xterm.js implements `OSC 10/11/12` but not `OSC 6`, and a background tint
overrides the theme the user chose, which is a loud thing for a wrapper to do
uninvited. The cursor is honoured almost everywhere, costs the user nothing,
and a terminal that does not know the sequence swallows it — so none of this
needs capability detection.

It is handed back when Claude exits, for the same reason a title is set before
launch: the colour belongs to the session, and the session is over.

Truecolour is what makes these colours possible, and `ansis` is what makes it
safe: it detects what the terminal can show and downgrades a `38;2;r;g;b`
request to 256 or 16 colours rather than emitting bytes an older terminal
would mangle.

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
