# Conventions

Standing preferences stated during development. They apply to all future work in this repository
without needing to be restated.

## Naming

- Name files in **camelCase** — `targetKind.ts`, `writeSchema.ts`. Never `something-something.ts`.
- Use **kebab-case for folders only**.
- Two names stay hyphenated because they are not ours to choose: `package-lock.json` (npm owns it)
  and `claude-bit.json` (the config filename users write — part of the public interface, not the
  source layout).

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

- Never hand-write ANSI colour escapes. Use a colour library (`picocolors`).
- Ask for a colour **role**, not a colour: `accent`, `muted`, `strong`, `error` from
  `terminal/palette.ts`, so the scheme changes in one place.
- Never leave raw control characters in source. Write `` and ``, and keep them behind
  named constants.
- The terminal window title must follow the **worktree name**.

## Configuration

- Everything must be configurable **per project**, through one simple config file.
- Defaults belong in the schema, so a project only writes down what it changes.

## Distribution

- The tool is meant to be run through a package runner — `npx`, `pnpm dlx`, `yarn dlx`, `bunx` —
  not installed globally or linked by hand.
- `bin` must point at compiled JavaScript in `dist/`, never at a `.ts` file: Node refuses to strip
  types for files under `node_modules`, so a TypeScript entry point fails for anyone who installs
  the package.
- `prepare` builds `dist/` before pack, publish and git installs. Keep it working.
- `files` ships `dist/` and `schema.json` only.

## Tooling

- Typecheck with **tsgo**, lint with **oxlint**, format with **oxfmt**, test with **vitest**.
- `npm run check` runs those four plus the build, and must stay green.

## Architecture

- Readability first: prefer clear structure over clever code.
- Keep the decision layer pure and inject its dependencies, so behaviour is covered by tests rather
  than by running the real binary.
- Confine side effects to the edges of the program.
