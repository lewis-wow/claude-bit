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
└
```

## Run it

No install step — run the artifact CI built and attached to the latest release:

```sh
npx https://github.com/lewis-wow/claude-bit/releases/latest/download/claude-bit.tgz
pnpm dlx https://github.com/lewis-wow/claude-bit/releases/latest/download/claude-bit.tgz
```

That tarball is produced by the [Release workflow](.github/workflows/release.yml): checked,
built and packed on CI, never on your machine. Nothing is compiled locally.

Arguments pass through, so appending `--model opus` works as you would expect.

Once the package is published to npm, the short form works too:

```sh
npx claude-bit            # npm
pnpm dlx claude-bit       # pnpm
yarn dlx claude-bit       # yarn
bunx claude-bit           # bun
```

To run unreleased code from `main`, point a runner at the repository instead. This one _does_
build on your machine, via `prepare`:

```sh
npx github:lewis-wow/claude-bit
pnpm dlx github:lewis-wow/claude-bit
```

Requires Node 22 or newer.

### Publishing

`npx claude-bit` only resolves once the package is on a registry. The package is ready for it —
`prepare` builds `dist/` before `npm pack` and `npm publish`, and `files` ships `dist/` and
`schema.json` and nothing else. Publishing is a deliberate, public step, so it is left to you:

```sh
pnpm run check    # fmt, lint, typecheck, test, build
pnpm publish      # add --access public for a scoped name
```

The name `claude-bit` was unclaimed on npm at the time of writing. Check it is still free, or
scope it (`@you/claude-bit`), before publishing.

Issues and pull requests go to [https://github.com/lewis-wow/claude-bit](https://github.com/lewis-wow/claude-bit).

### Installing instead

```sh
pnpm add -g claude-bit       # from the registry
pnpm install && pnpm link -g # from a clone, for development
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

| Key                          | Default                              | Meaning                                                                                             |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `command`                    | `"claude"`                           | Executable to launch.                                                                               |
| `args`                       | `["--dangerously-skip-permissions"]` | Flags added to every launch, before yours.                                                          |
| `resumeExistingSession`      | `true`                               | Add `--continue` when the worktree already has a conversation.                                      |
| `sessionsDirectory`          | `null`                               | Where Claude Code keeps transcripts. `null` means `~/.claude/projects`; a leading `~/` is expanded. |
| `color`                      | `"auto"`                             | `auto` \| `always` \| `never`. `auto` honours `NO_COLOR`.                                           |
| `picker.enabled`             | `true`                               | Turn the picker off entirely.                                                                       |
| `picker.message`             | `"Where should Claude run?"`         | Prompt above the list.                                                                              |
| `picker.maxItems`            | `12`                                 | Rows shown before the list scrolls.                                                                 |
| `picker.createWorktreeLabel` | `"+ Create new worktree…"`           | Label of the create entry.                                                                          |
| `picker.passthroughFlags`    | see `schema.json`                    | Arguments that mean "skip the picker".                                                              |
| `worktree.namePlaceholder`   | `"feat/my-thing"`                    | Placeholder in the name prompt.                                                                     |
| `worktree.args`              | `[]`                                 | Flags used only when creating a worktree, e.g. `["--tmux"]`.                                        |
| `terminal.title`             | `"{worktree} · {branch}"`            | Window title, or `null` to leave the title alone.                                                   |
| `terminal.sessionName`       | `"{worktree}"`                       | Passed to `claude --name`, or `null` to omit it.                                                    |

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
  terminal/
    palette.ts       colour roles, backed by picocolors
    title.ts         title templates and the escape sequence that carries them
    colorMode.ts     Auto | Always | Never
    titleToken.ts    Worktree | Branch | Repo | Path
  ui/
    picker.ts        the interactive chooser
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
