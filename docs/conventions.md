# Conventions

Standing preferences stated during development. They apply to all future work in this repository
without needing to be restated.

## Naming

- Name files in **camelCase** — `targetKind.ts`, `writeSchema.ts`. Never `something-something.ts`.
- Use **kebab-case for folders only**.
- One name stays hyphenated because it is not ours to choose: `pnpm-lock.yaml`, which pnpm owns.

## Enums

- Model every fixed set of string values as an `as const` object. Never write a bare string-literal
  union inline.
- Give each enum **its own file**, with a type of the same name merged alongside the object:

  ```ts
  export const TargetKind = {
    Existing: 'existing',
    New: 'new',
  } as const;

  export type TargetKind = (typeof TargetKind)[keyof typeof TargetKind];
  ```

- Refer to members through the object — `TargetKind.Existing`, never the raw `'existing'`.
- Declare union members as `kind: typeof TargetKind.Existing`.
- This applies to **every** sum type, including unions that would otherwise be discriminated by
  property presence rather than by a `kind` field.

## Comments

- Do not write comments in source files. Names and structure must carry the meaning.
- When a value would otherwise be cryptic, give it a name instead of a comment — `OSC` and `BEL`
  rather than an escape sequence with an explanation next to it.
- Rationale worth keeping goes in `README.md` or in this folder, never in the code.

## Terminal output

- Never hand-write ANSI colour escapes. Use a colour library (`ansis`), which also downgrades a
  truecolour request to 256 or 16 colours on terminals that cannot show it.
- Ask for a colour **role**, not a colour: `action`, `danger`, `muted`, `strong`, `error` and
  `session` from `terminal/palette.ts`, so the scheme changes in one place.
- Never leave raw control characters in source. Write `\u001B` and `\u0007`, and keep them behind
  named constants.
- The terminal window title must follow the **worktree name**.

## No configuration

- The tool has **no configuration**: no config file, no schema, no options of its own. Copy it,
  run it, and it behaves the same in every repository.
- Anything that would once have been an option is a **named constant** in the module that uses
  it — the command and its arguments in `claude/plan.ts`, the prompts in `ui/picker.ts`, the
  colours in `terminal/sessionColor.ts`. One place to read, one place to change.
- Prefer a sensible fixed answer to a question the user has to answer. If a choice genuinely has
  two defensible answers, pick the safer one and say why here, rather than adding a setting.
- Arguments the user types are forwarded to `claude` untouched and last, which is the only
  tuning the tool needs to offer.

## Distribution

- The tool is **copied into a project**, not installed from a registry and not run from a remote
  repository. `cp -R src/. <project>/tools/claude-bit/` is the whole of it.
- `src/` must therefore stand on its own: no imports outside it, no build step, no generated
  files, nothing that only exists in this repository.
- `src/package.json` carries `{ "type": "module" }` and must stay. Node takes a file's module
  type from the nearest `package.json` above it, so without that line the copy breaks inside a
  CommonJS project — which is most of them.
- The entry point is `src/cli.ts`, run directly. That needs **Node 22.18 or newer**, where type
  stripping stopped needing a flag; `engines` says so.
- Keep the dependency list to what a copy can reasonably carry. Two, today.
- Nothing is published. `package.json` is `private`, and there is no `bin`, no `files` and no
  release workflow to keep working.

## Tooling

- The package manager is **pnpm**, pinned in `packageManager`. Use `pnpm`, never `npm`, for
  development. CI's copy job uses `npm` on purpose: it stands in for a stranger's project, which
  is as likely to use npm as anything else.
- Typecheck with **tsgo**, lint with **oxlint**, format with **oxfmt**, test with **vitest**.
- `pnpm run check` runs those four and must stay green — with no lint warnings, not just no
  errors. There is no build to run.
- `.nvmrc` tracks the current Node **Active LTS**. `engines` stays at the lowest version actually
  supported, which is lower.

## Architecture

- Readability first: prefer clear structure over clever code.
- Keep the decision layer pure and inject its dependencies, so behaviour is covered by tests rather
  than by running the real binary.
- Confine side effects to the edges of the program.
