# claude-bit

A wrapper around the `claude` CLI that puts a git-worktree picker in front of every session.
Entry is `src/cli.ts` → `src/app.ts`; the pure decision layer is `src/claude/plan.ts`.

Public repository: <https://github.com/lewis-wow/claude-bit> — see [docs/github.md](docs/github.md) for how it is used, what is
not set up yet, and what to check before pushing.

## Conventions

The full set is in [docs/conventions.md](docs/conventions.md) — read it before writing code here.
[docs/architecture.md](docs/architecture.md) carries the rationale the no-comments rule keeps out
of the source, and [docs/verifying.md](docs/verifying.md) is the checklist for changes, because a
green `npm run check` has repeatedly not meant a working tool.

@docs/conventions.md

In short, and without exception:

- **camelCase filenames**, kebab-case for folders only.
- **No comments in source files.** Name things instead.
- **Enums are `as const` objects**, one per file, type merged with the object. Never a bare
  string-literal union.
- **No hand-written ANSI escapes.** Colour comes from `ansis` via the roles in
  `src/terminal/palette.ts`; control characters live behind named constants.
- **No configuration.** No config file, no schema, no options: every former setting is a named
  constant in the module that uses it.
- **`src/` is the deliverable.** It is copied into other projects whole, so it must stand alone:
  no build step, no generated files, no imports outside it.

## Commands

```sh
pnpm run dev        # run the CLI straight from src/, no build — Node strips the types
pnpm run check      # fmt:check + lint + typecheck + test + build — must stay green
pnpm test           # vitest
pnpm run typecheck  # tsgo
pnpm run fmt        # oxfmt
```

This is a **pnpm** project (pinned in `packageManager`). Do not use `npm` for development; CI's
copy job uses it deliberately, standing in for a stranger's project.

## Notes

- Verify against a real repository, not just tests: both the standard layout and the bare layout
  (`proj/.bare` beside `proj/main`, `proj/feat-x`) must work.
- `ansis` ships both ESM and CJS, so `import ansis, { Ansis } from 'ansis'` works under real Node
  as well as vitest — the trap `picocolors` (CJS, default export only) used to spring.
- The tool is **copied into a project**, not installed: `src/` must stand alone, with no build
  step and no imports outside it. `src/package.json` (`{ "type": "module" }`) is load-bearing —
  without it the copy is parsed as CommonJS inside a CommonJS project and every import fails.
- Nothing is published. `package.json` is `private`; there is no `bin`, `dist` or release
  workflow.
- The repository is public and is the distribution channel, so a broken `main` is a broken copy
  for everyone. Use `gh` for repository work; it is already authenticated.
- CI runs the check, then copies `src/` into a scratch project and runs it there. Keep it green.
