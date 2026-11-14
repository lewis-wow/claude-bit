# claude-bit

[lewis-wow/claude-bit](https://github.com/lewis-wow/claude-bit)

A thin wrapper around the `claude` CLI that puts git worktrees in front of every session.

Run `claude-bit` anywhere inside a repository and it asks which worktree Claude should run in —
the main checkout, any linked worktree, or a new one it creates for you. It then names the
terminal window after that worktree and colours the session by the kind of work it holds,
continues the worktree's existing conversation if there is one, and hands over to `claude` with
your own arguments appended.

```
┌  Where should Claude run?
│
◆  claude-bit            main · 3 minutes ago · main checkout
│  +  Create new worktree…
│  feat+retry            feat/retry · 2 hours ago
│  fix+title             fix/title · yesterday
│  spike-parser          spike-parser · yesterday
│  ×  Remove worktrees…
└

Creating sits second, a keystroke from the top, and removing sits last. They are the only
coloured entries in the list — bright cyan and bright red, bold — so neither reads as one more
place to run. Landing on either brightens it and shows what it will do next:

```

│ ● + Create new worktree… (asks for a name)
│ ● × Remove worktrees… (asks which, then confirms)

```

```

The session's cursor takes the colour of its [change type](#change-types) — green for a feature,
amber for a fix — so a glance tells you what kind of work a window holds. The last entry cleans up
after you — see [Removing worktrees](#removing-worktrees).

There is nothing to configure. No config file, no flags of its own, no schema: run it and it
works the same way in every repository.

## Copy it in

This is not a package to install. Copy the source into your project and it is yours — edit it,
rename it, delete the parts you do not want:

```sh
mkdir -p tools/claude-bit
cp -R /path/to/claude-bit/src/. tools/claude-bit/
pnpm add @clack/prompts ansis
```

Then run the entry point, from anywhere inside the repository:

```sh
node tools/claude-bit/cli.ts
```

Arguments pass through, so `node tools/claude-bit/cli.ts --model opus` works as you would expect,
and the exit status is whatever `claude` exited with. A script makes it shorter:

```json
{
  "scripts": {
    "claude": "node tools/claude-bit/cli.ts"
  }
}
```

Two things it needs, and nothing else:

- **Node 22.18 or newer**, which is where type stripping stopped needing a flag. There is no build
  step — Node reads the TypeScript directly.
- **`@clack/prompts` and `ansis`**, the only two dependencies.

The copied folder carries a `package.json` of its own saying `{ "type": "module" }`. That one line
is what lets it work in a project that is CommonJS, because Node decides a file's module type from
the nearest `package.json` above it, not from yours.

Nothing phones home, nothing is fetched at run time, and your copy never changes under you. To
take a later version, copy the folder again — and if you have edited it, that is a diff you can
read.

## How it decides

| Situation                                                                      | What happens                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| Interactive terminal, inside a repository                                      | The picker opens                               |
| You pass a flag that already names a session (`-c`, `--resume`, `-p`, `-w`, …) | Straight to `claude`, no picker                |
| stdin or stdout is not a terminal (piped, redirected, CI)                      | Straight to `claude` in the enclosing worktree |
| Not inside a git repository                                                    | Straight to `claude` in the current directory  |
| The chosen worktree has a stored conversation                                  | `--continue` is added                          |

Arguments you type are always forwarded last, so they override anything the wrapper adds:

```sh
claude-bit --model opus "explain the picker"
```

## Removing worktrees

Worktrees pile up, and `git worktree remove` is a path away from the one you want. The picker's
last entry takes care of it: pick the worktrees to remove, confirm, and the picker reopens on
what is left so you can still choose where to run.

```
┌  Which worktrees should be removed?
│
◆  ◼ feat-config         feat/config · 2 hours ago
│  ◻ fix-title           fix/title · yesterday
└
◆  Remove feat-config? Its directory goes, its branch stays.
│  ○ Yes / ● No
└
```

Only the worktree's directory goes; the branch stays, so nothing you committed is lost. Two
worktrees are never offered, because removing them is either impossible or hostile:

- the **main checkout** — git refuses to remove it anyway;
- the worktree you are **standing in** — removing it would delete the directory you are sitting in.

A [bare layout](#repository-layouts) has no main checkout, so only the second rule applies there:
`proj/main` is an ordinary linked worktree and can be removed like any other. The repository keeps
working if you do.

A worktree with uncommitted or untracked changes is refused by git, and the picker reopens with
git's own reason above the list. Nothing here passes `--force`: work you have not committed is
never thrown away on your behalf. If you really want that worktree gone, `git worktree remove
--force` is one command away, and you will have said so yourself.

Escape quits, as it does everywhere else in the picker. To back out of a removal without quitting,
select nothing, or answer no.

## Repository layouts

Both common layouts work:

```
proj/                       proj/
  .git/                       .bare/
  src/            and         main/
proj-feat-x/                  feat-x/
```

On the left, `proj` is the main checkout; it is bolded and labelled in the picker, and it is
where a new worktree is created from. On the right the repository is bare, so there is no main
checkout — the `.bare` directory is never offered as a place to run, and nothing is labelled as
the main checkout. Both layouts are otherwise the same to use.

## Terminal titles

The title is set twice over, because two things want to own it:

- `claude-bit` writes an OSC title sequence before handing off, which is what you see while
  Claude starts up;
- `--name` tells Claude Code itself what this session is called, which it shows in its prompt
  box, in `/resume`, and in the title it maintains afterwards.

Claude Code takes the title over within a second of starting, so what you end up looking at is
the name `--name` gave it: the worktree's directory name. The title `claude-bit` sets adds the
branch, and is what you see while Claude boots.

### VS Code shows `node` on the tab

VS Code labels a terminal tab with the name of the running **process**, so every session reads
`node` no matter what title is set. The OSC title is available there, just under a different
name — `${sequence}`:

```json
{
  "terminal.integrated.tabs.title": "${sequence}${separator}${process}"
}
```

`${sequence}` alone is enough if every terminal you open sets a title; keeping `${process}` after
it means a plain shell still has something to show.

Worth knowing before you turn this on: the tab will not keep reading `worktree · branch`.
`claude-bit` sets that title once, just before handing off, and Claude Code then maintains its
own — so the tab follows Claude. That is usually what you want, and the worktree name survives
anyway, because `--name` carries it.

## Change types

Name a worktree after what it changes and the colour follows from that. You type the whole name
yourself — no list to arrow through — and the types are spelled out above the prompt, each in its
own colour, so there is nothing to memorise and nothing to guess:

```
◇  Name it after what it changes ─────────────────────────────────────╮
│                                                                     │
│  feat           a new capability                                    │
│  fix            a defect, repaired                                  │
│  refactor       same behaviour, written better                      │
│  test           tests only                                          │
│  docs           documentation only                                  │
│  chore          upkeep — dependencies, tooling, housekeeping        │
│  perf           same behaviour, faster                              │
│  ci             pipelines, workflows, releases                      │
│  anything else  a name of your own, in a quieter colour of its own  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────╯
│
◆  New worktree name
│  fix/retry-logic
└
```

A type becomes the branch prefix, the way a conventional commit names one. None of this is
compulsory: any name is accepted, and a worktree that names no type gets a quiet colour of its
own rather than a complaint. Only an empty name is refused.

## Session colours

The colour of a session **is** its type. A feature is green, a fix amber, documentation blue, and
every terminal running that kind of work looks the same, in every repository:

| `feat` | `fix` | `refactor` | `test` | `docs` | `chore` | `perf` | `ci` | anything else |
| ------ | ----- | ---------- | ------ | ------ | ------- | ------ | ---- | ------------- |
| green  | amber | violet     | yellow | sky    | blue    | pink   | mint | grey          |

A worktree whose name starts with none of them — `main`, `spike-the-parser`, anything created
outside this tool — still gets a colour of its own, derived from the name, but a **muted** one.
Typed worktrees are vivid, free ones are quiet, so a free name can never be mistaken for a type
at a glance while still being told apart from its neighbours.

The type is read back from the directory name or the branch, whichever carries it, so
`feat/retry`, `feat+retry` and `feat-retry` are all a feature. Red belongs to errors and to the
remove entry, and no type borrows it.

What this trades away is worth knowing: two features open at once are both green. The colour
tells you what kind of work a window holds, not which window it is — the title does that.

The picker itself stays plain — names as they are, details dim, the main checkout bold, and the
two actions in their own bright colours. The session colour appears in one place only: the
cursor, from the moment Claude starts until it exits.

### What gets painted

The **cursor**, and nothing else: `OSC 12` on the way in, `OSC 112` to hand it back when Claude
exits. Almost every terminal honours it, VS Code included, and one that does not swallows the
sequence silently — so there is nothing to detect and nothing to switch off. Your theme keeps
its background, its tab and everything else.

Colour is only ever written to a terminal: pipe the output or redirect it and nothing is sent.
`NO_COLOR` in the environment leaves the picker's labels plain, as it does everywhere else.

## Layout

```
src/
  cli.ts             entry point: process in, exit status out
  app.ts             the flow — find repo, choose worktree, plan launch
  resolutionKind.ts  Launch | Cancelled
  changeType.ts      Feat | Fix | Refactor | Test | Docs | Chore | Perf | Ci, and reading one
                     back off a worktree name
  claude/
    plan.ts          pure: target → the exact command to run, and its colour
    launcher.ts      spawns it and mirrors the child's exit status
    sessions.ts      whether a directory already has a stored conversation
    targetKind.ts    Existing | New
  git/
    git.ts           the git runner, injectable so nothing needs a real repo to test
    porcelain.ts     pure parsers for git's machine-readable output
    repository.ts    worktrees, ordered the way the picker wants them
    removeWorktrees.ts  the one mutation: git worktree remove, refusals collected
  terminal/
    palette.ts       colour roles, backed by ansis
    hslToRgb.ts      a hue, saturation and lightness as a terminal colour
    title.ts         the title, and the escape sequence that carries it
    cursorColor.ts   colouring the cursor, and handing it back on exit
    sessionColor.ts  the colour a worktree name always resolves to
    colorChannel.ts  Red | Green | Blue
    controlCharacters.ts  OSC and BEL, named rather than inlined
  ui/
    picker.ts        all the prompting; one Choice comes back
    chooseTarget.ts  asks until the answer is a worktree, removing in between
    choiceKind.ts    Launch | Removal
    labels.ts        how a worktree reads in the list
```

The decision layer (`plan.ts`, `app.ts`) is pure and injected, so what actually matters — which
flags Claude receives, in what order — is covered by tests rather than by running the binary.
Everything the tool could have made configurable is a named constant at the top of the file that
uses it: `plan.ts` holds the command and its arguments, `picker.ts` the prompts, `sessionColor.ts`
the colours.
[docs/architecture.md](docs/architecture.md) explains why the pieces are split the way they are,
[docs/verifying.md](docs/verifying.md) covers what the test suite cannot see,
[docs/conventions.md](docs/conventions.md) records the house style, and
[docs/github.md](docs/github.md) covers the repository itself.

Files are named in camelCase; only folders use kebab-case. Each enum is an `as const` object in
a file of its own, with a type of the same name merged alongside it. The full set of conventions
is in [docs/conventions.md](docs/conventions.md).

## Development

```sh
pnpm install          # clone first; `nvm use` or `fnm use` picks the version in .nvmrc
pnpm run dev          # run the CLI from source — node src/cli.ts
pnpm run check        # format, lint, typecheck, test
pnpm test             # vitest
pnpm run typecheck    # tsgo (TypeScript's native port)
pnpm run lint         # oxlint
pnpm run fmt          # oxfmt
```

`pnpm run dev` always runs in the repository root, because that is where `pnpm run` puts you. To
try the picker against some other repository, call the entry point by path from there:

```sh
cd ~/some/other/repo && node ~/code/claude-bit/src/cli.ts
```

Every push and pull request runs that check on CI, then copies `src/` into a scratch project that
has never seen this repository and runs it there, in a real worktree — because copying is how
anyone uses this, and it is the one thing the test suite cannot see. See
[.github/workflows/ci.yml](.github/workflows/ci.yml).
