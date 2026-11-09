# claude-bit

[lewis-wow/claude-bit](https://github.com/lewis-wow/claude-bit)

A thin wrapper around the `claude` CLI that puts git worktrees in front of every session.

Run `claude-bit` anywhere inside a repository and it asks which worktree Claude should run in —
the main checkout, any linked worktree, or a new one it creates for you. It then names the
terminal window after that worktree, continues the worktree's existing conversation if there is
one, and hands over to `claude` with your own arguments appended.

```
┌  Where should Claude run?
│
◆  claude-bit            main · 3 minutes ago · main checkout
│  + Create new worktree…
│  feat-config           feat/config · 2 hours ago
│  fix-title             fix/title · yesterday
│  - Remove worktree…
└
```

The last entry cleans up after you — see [Removing worktrees](#removing-worktrees).

## Run it

No install step — run it straight from your package manager's runner:

```sh
npx @lewis_wow/claude-bit            # npm
pnpm dlx @lewis_wow/claude-bit       # pnpm
yarn dlx @lewis_wow/claude-bit       # yarn
bunx @lewis_wow/claude-bit           # bun
```

Arguments pass through, so appending `--model opus` works as you would expect.

The published package is the artifact CI built — checked, packed and smoke-tested by the
[Release workflow](.github/workflows/release.yml), never built on your machine. To pin one exact
build instead of tracking the latest, point a runner at the release tarball:

```sh
npx https://github.com/lewis-wow/claude-bit/releases/latest/download/claude-bit.tgz
```

To run unreleased code from `main`, point a runner at the repository instead. This one _does_
build on your machine, via `prepare`:

```sh
npx github:lewis-wow/claude-bit
pnpm dlx github:lewis-wow/claude-bit
```

Requires Node 22 or newer.

### Publishing

Publishing happens on CI, never from a laptop. Tagging a version is the whole release:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The [Release workflow](.github/workflows/release.yml) then refuses a tag that disagrees with the
version in `package.json`, runs the full check, packs, creates the GitHub release and publishes
to npm with a provenance attestation tying the package to that workflow run.

The package is published under the `@lewis_wow` scope, which is why `--access public` is part of
the publish step: npm makes scoped packages private by default.

Issues and pull requests go to [https://github.com/lewis-wow/claude-bit](https://github.com/lewis-wow/claude-bit).

### Installing instead

```sh
pnpm add -g @lewis_wow/claude-bit  # from the registry
pnpm install && pnpm link -g       # from a clone, for development
```

### From a clone

```sh
nvm use          # or `fnm use` — picks the version in .nvmrc
pnpm install     # `prepare` builds dist/ automatically
pnpm run check   # fmt, lint, typecheck, test, build
```

This project uses **pnpm**, pinned in `packageManager`; `corepack enable` picks up the right
version. The one script that stays on npm is `prepare`, because it runs on a _consumer's_ machine
during `npx github:...` and npm ships with Node while pnpm may not be installed there.

`.nvmrc` pins Node 26, the current Active LTS ("Lithium"). The test suite and build are verified
on both 26 and 24.

Running the TypeScript entry point directly (`node src/cli.ts`) additionally needs Node 22.18 or
newer, which is where type stripping arrived. The published package does not — it ships compiled
JavaScript, because Node refuses to strip types for files under `node_modules`.

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
git's own reason above the list. Set `worktree.forceRemove` if you would rather it went anyway —
the confirmation then says so, because that is the one case where removal costs you work. Set
`picker.removeWorktreeLabel` to `null` to hide the entry entirely.

Escape quits, as it does everywhere else in the picker. To back out of a removal without quitting,
select nothing, or answer no.

## Configuration

Configuration is per project. Drop a `claude-bit.json` (or `.claude-bit.json`) anywhere at or
above your working directory — normally the repository root:

```json
{
  "$schema": "https://lewis-wow.github.io/claude-bit/schema.json",
  "args": ["--dangerously-skip-permissions"],
  "terminal": {
    "title": "{repo}/{worktree} · {branch}"
  },
  "worktree": {
    "args": ["--tmux"]
  }
}
```

Layers apply in order, each overriding the one before it:

1. the built-in defaults
2. `~/.config/claude-bit/config.json` (or `$XDG_CONFIG_HOME/claude-bit/config.json`)
3. the file in the **main checkout** — configuration belongs to the repository, and a linked
   worktree lives outside the main checkout, so walking up from there would never reach it.
   A bare layout (below) has no main checkout, so this layer is simply absent
4. the nearest file above the current directory, bounded by the worktree that directory sits in,
   so a single worktree can override the repository's settings

Objects merge key by key, so a project only states what it changes. Arrays replace wholesale —
`args` is a complete statement of intent, not something to append to. Unknown keys are an error,
so a typo never passes silently.

### Options

| Key                          | Default                                | Meaning                                                                                             |
| ---------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `command`                    | `"claude"`                             | Executable to launch.                                                                               |
| `args`                       | `["--dangerously-skip-permissions"]`   | Flags added to every launch, before yours.                                                          |
| `resumeExistingSession`      | `true`                                 | Add `--continue` when the worktree already has a conversation.                                      |
| `sessionsDirectory`          | `null`                                 | Where Claude Code keeps transcripts. `null` means `~/.claude/projects`; a leading `~/` is expanded. |
| `color`                      | `"auto"`                               | `auto` \| `always` \| `never`. `auto` honours `NO_COLOR`.                                           |
| `picker.enabled`             | `true`                                 | Turn the picker off entirely.                                                                       |
| `picker.message`             | `"Where should Claude run?"`           | Prompt above the list.                                                                              |
| `picker.maxItems`            | `12`                                   | Rows shown before the list scrolls.                                                                 |
| `picker.createWorktreeLabel` | `"+ Create new worktree…"`             | Label of the create entry.                                                                          |
| `picker.removeWorktreeLabel` | `"- Remove worktree…"`                 | Label of the remove entry, or `null` to hide it.                                                    |
| `picker.removeMessage`       | `"Which worktrees should be removed?"` | Prompt above the list of removable worktrees.                                                       |
| `picker.passthroughFlags`    | see `schema.json`                      | Arguments that mean "skip the picker".                                                              |
| `worktree.namePlaceholder`   | `"feat/my-thing"`                      | Placeholder in the name prompt.                                                                     |
| `worktree.args`              | `[]`                                   | Flags used only when creating a worktree, e.g. `["--tmux"]`.                                        |
| `worktree.forceRemove`       | `false`                                | Remove a worktree even when it still holds uncommitted or untracked changes.                        |
| `terminal.title`             | `"{worktree} · {branch}"`              | Window title, or `null` to leave the title alone.                                                   |
| `terminal.sessionName`       | `"{worktree}"`                         | Passed to `claude --name`, or `null` to omit it.                                                    |

Both templates understand `{worktree}`, `{branch}`, `{repo}` and `{path}`. A token with no value
disappears along with the separator beside it, so a detached worktree reads `api`, not `api · `.

Each file is validated on its own before the layers are merged, so an error names the file that
actually contains the bad value.

### JSON schema

`schema.json` is generated from the very same schema that validates your config at runtime
(`npm run schema`), so the two can never drift. Point your editor at it with a `$schema` key and
you get completion, inline descriptions, defaults and validation for every option:

```json
{ "$schema": "https://lewis-wow.github.io/claude-bit/schema.json" }
```

That URL is served from GitHub Pages, redeployed from `main` on every push by the
[Pages workflow](.github/workflows/pages.yml), which also fails the build if `schema.json` has
drifted from `src/config/schema.ts`. <https://lewis-wow.github.io/claude-bit/> lists the
top-level options in a table.

It needs no install and no registry. If you would rather resolve it offline, point at a local
copy — `./schema.json` in this repository, or `./node_modules/claude-bit/schema.json` once the
package is installed.

VS Code users can skip the `$schema` key entirely and map it once in `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["claude-bit.json", ".claude-bit.json"],
      "url": "https://lewis-wow.github.io/claude-bit/schema.json"
    }
  ]
}
```

The schema ships inside the published package, so it is versioned alongside the code that reads
it.

## Repository layouts

Both common layouts work:

```
proj/                       proj/
  .git/                       .bare/
  src/            and         main/
proj-feat-x/                  feat-x/
```

On the left, `proj` is the main checkout; it is bolded and labelled in the picker, and its
`claude-bit.json` applies to every worktree. On the right the repository is bare, so there is no
main checkout — the `.bare` directory is never offered as a place to run, nothing is labelled as
the main checkout, and each worktree's own committed config applies. The `{repo}` token resolves
to `proj` in both cases.

## Terminal titles

The title is set twice over, because two things want to own it:

- `claude-bit` writes an OSC title sequence before handing off, which is what you see while
  Claude starts up;
- `--name` tells Claude Code itself what this session is called, which it shows in its prompt
  box, in `/resume`, and in the title it maintains afterwards.

Set `terminal.title` to `null` if your shell prompt manages the title, or `terminal.sessionName`
to `null` if you would rather Claude named the session itself.

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

Worth knowing before you turn this on: the tab will not keep reading `{worktree} · {branch}`.
`claude-bit` sets that title once, just before handing off, and Claude Code then maintains its
own — so the tab follows Claude. That is usually what you want, and the worktree name survives
anyway, because `terminal.sessionName` passes it to `--name`.

## Layout

```
src/
  cli.ts             entry point: process in, exit status out
  app.ts             the flow — find repo, load config, choose worktree, plan launch
  resolutionKind.ts  Launch | Cancelled
  claude/
    plan.ts          pure: target + config → the exact command to run
    launcher.ts      spawns it and mirrors the child's exit status
    sessions.ts      whether a directory already has a stored conversation
    targetKind.ts    Existing | New
  config/
    schema.ts        the config contract, and the source of schema.json
    merge.ts         how layers combine
    load.ts          discovery, layering, validation
  git/
    git.ts           the git runner, injectable so nothing needs a real repo to test
    porcelain.ts     pure parsers for git's machine-readable output
    repository.ts    worktrees, ordered the way the picker wants them
    removeWorktrees.ts  the one mutation: git worktree remove, refusals collected
  terminal/
    palette.ts       colour roles, backed by picocolors
    title.ts         title templates and the escape sequence that carries them
    colorMode.ts     Auto | Always | Never
    titleToken.ts    Worktree | Branch | Repo | Path
  ui/
    picker.ts        all the prompting; one Choice comes back
    chooseTarget.ts  asks until the answer is a worktree, removing in between
    choiceKind.ts    Launch | Removal
    labels.ts        how a worktree reads in the list
```

The decision layer (`plan.ts`, `app.ts`) is pure and injected, so what actually matters — which
flags Claude receives, in what order — is covered by tests rather than by running the binary.
[docs/architecture.md](docs/architecture.md) explains why the pieces are split the way they are,
[docs/verifying.md](docs/verifying.md) covers what the test suite cannot see,
[docs/conventions.md](docs/conventions.md) records the house style, and
[docs/github.md](docs/github.md) covers the repository itself.

Files are named in camelCase; only folders use kebab-case. Each enum is an `as const` object in
a file of its own, with a type of the same name merged alongside it. The full set of conventions
is in [docs/conventions.md](docs/conventions.md).

## Development

```sh
pnpm run check        # format, lint, typecheck, test, build
pnpm test             # vitest
pnpm run typecheck    # tsgo (TypeScript's native port)
pnpm run lint         # oxlint
pnpm run fmt          # oxfmt
pnpm run build        # emit dist/ — what the published package runs
pnpm run schema       # regenerate schema.json after editing config/schema.ts
```

Every push and pull request runs the same check on CI, then packs the result and smoke-tests that
packed artifact in a real worktree — see [.github/workflows/ci.yml](.github/workflows/ci.yml).
