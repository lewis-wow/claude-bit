# Verifying a change

`npm run check` passing is necessary and **not sufficient**. Every bug that
reached this codebase passed the test suite first. This is the list of things
the suite structurally cannot see, and how to check them.

## Why green tests are not enough here

The tool's job is to spawn another program in a directory chosen from real git
state. Git, the terminal and the module loader all behave differently under
test than in production:

| What broke                                  | Test suite said | Reality                                                            |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| `import { createColors } from 'picocolors'` | pass            | crash — picocolors is CJS; vitest resolves it, Node does not       |
| `bin` pointing at `cli.ts`                  | pass            | crash once installed — Node will not strip types in `node_modules` |
| Bare repository layout                      | pass            | picker offered `.bare`; no main checkout was ever detected         |
| Repository with no commits                  | pass            | `git show` on the null object id is fatal                          |
| Interactivity from `stdin.isTTY` alone      | pass            | `claude-bit > out.log` drew the prompt into the file               |

The pattern: **the suite exercises the decision layer, which is pure. The bugs
were all at the edges it deliberately fakes.**

## Scratch repositories

Both layouts must work. Build them once and keep them around.

Standard layout — main checkout plus a linked worktree:

```sh
git init -q repo && cd repo
git -c commit.gpgsign=false commit -qm init --allow-empty
git worktree add -q ../repo-alpha -b feat/alpha
```

Bare layout — no main checkout at all, which is the case that breaks naive
code:

```sh
git init -q --bare .bare
echo "gitdir: ./.bare" > .git
git worktree add -q main
git -C main -c commit.gpgsign=false commit -qm init --allow-empty
git worktree add -q feat-x
```

Also worth keeping: a repository with **no commits** (`git init` and nothing
else), and a plain directory that is not a repository at all.

## Watching what gets spawned, without spawning Claude

Point `command` at a stub and read back exactly what the wrapper decided:

```sh
cat > /tmp/fake-claude <<'SH'
#!/bin/sh
echo "CWD=$(pwd)"
echo "ARGS=$*"
exit 7
SH
chmod +x /tmp/fake-claude
echo '{"command":"/tmp/fake-claude"}' > repo/claude-bit.json
```

Exit code 7 coming back out confirms the wrapper mirrors the child's status
rather than inventing one.

## Terminal behaviour

A pty harness (`script`) echoes keystrokes back into the captured output and is
close to unreadable. Faking the TTY flags in-process is far easier to read:

```ts
Object.defineProperty(process.stdout, 'isTTY', { value: true });
await import('../src/cli.ts');
```

Then inspect the raw bytes — `cat` hides control characters, which is exactly
how an escape-sequence bug stays invisible:

```sh
node probe.ts | cat -v        # shows ^[ and ^G
```

To confirm the title sequence itself, `JSON.stringify` it rather than printing
it.

## Packaging

The published package is not the repository. Test what a user actually gets:

```sh
npm pack --pack-destination /tmp/pack
cd /tmp/consumer && npm init -y && npm install /tmp/pack/claude-bit-*.tgz
./node_modules/.bin/claude-bit        # must run from node_modules
```

`npx /path/to/repo` is **not** this test — npx links the directory instead of
installing it, so a `.ts` entry point appears to work. `pnpm dlx <tarball>` is
a closer check; `npx git+file:///path/to/repo` additionally exercises
`prepare`.

Confirm the tarball carries `dist/` and `schema.json` and nothing else:

```sh
tar -tzf /tmp/pack/claude-bit-*.tgz
```

## Node versions

`.nvmrc` pins the current Active LTS; `engines` allows older. Run the check on
both ends of that range:

```sh
fnm exec --using=26 npm run check   # .nvmrc / Active LTS
fnm exec --using=22 npm run check   # the floor in `engines`
```

Both are verified to pass, as is 24 in between.

## Before calling it done

- [ ] `npm run check` green, and lint **silent** — warnings count
- [ ] Standard layout, from the main checkout and from a linked worktree
- [ ] Bare layout, from more than one worktree
- [ ] Repository with no commits; directory that is not a repository
- [ ] A passthrough flag (`--resume`) skips the picker and suppresses `--continue`
- [ ] Config errors name the file that actually holds the bad value
- [ ] Packed tarball installs and runs from `node_modules`
- [ ] `schema.json` regenerates identically (`npm run schema`, then `git diff`)
