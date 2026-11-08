# claude-bit

A wrapper around the `claude` CLI that puts a git-worktree picker in front of every session.
Entry is `src/cli.ts` → `src/app.ts`; the pure decision layer is `src/claude/plan.ts`.

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
- **No hand-written ANSI escapes.** Colour comes from `picocolors` via the roles in
  `src/terminal/palette.ts`; control characters live behind named constants.
- **Everything configurable per project**, with defaults in the schema.

## Commands

```sh
npm run check      # fmt:check + lint + typecheck + test + build — must stay green
npm test           # vitest
npm run typecheck  # tsgo
npm run fmt        # oxfmt
npm run build      # emit dist/ — what the published package runs
npm run schema     # regenerate schema.json after editing src/config/schema.ts
```

## Notes

- Verify against a real repository, not just tests: both the standard layout and the bare layout
  (`proj/.bare` beside `proj/main`, `proj/feat-x`) must work.
- `picocolors` is CommonJS — import it by default export. Named imports resolve under vitest but
  fail under real Node.
- The tool runs via `npx` / `pnpm dlx`, so `bin` points at `dist/cli.js`, not at a `.ts` file:
  Node refuses to strip types under `node_modules`.
