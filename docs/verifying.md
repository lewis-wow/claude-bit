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
| `import { createColors } from 'picocolors'` | pass            | crash — that library was CJS; vitest resolved it, Node did not     |
| `bin` pointing at `cli.ts`                  | pass            | crash once installed — Node will not strip types in `node_modules` |
| Bare repository layout                      | pass            | picker offered `.bare`; no main checkout was ever detected         |
| Repository with no commits                  | pass            | `git show` on the null object id is fatal                          |
| Interactivity from `stdin.isTTY` alone      | pass            | `claude-bit > out.log` drew the prompt into the file               |
| iTerm2's tab-colour sequence                | pass            | VS Code is xterm.js, which has no `OSC 6` — the tab stayed grey    |

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

There is no config to point at a stub any more, so put one on `PATH` under the
name the tool launches:

```sh
mkdir -p /tmp/stub
cat > /tmp/stub/claude <<'SH'
#!/bin/sh
echo "CWD=$(pwd)"
echo "ARGS=$*"
exit 7
SH
chmod +x /tmp/stub/claude
PATH=/tmp/stub:$PATH claude-bit
```

Exit code 7 coming back out confirms the wrapper mirrors the child's status
rather than inventing one. To read the decision instead of the spawn, call
`resolveLaunch` directly and print the `Launch` it returns.

## Driving the picker without a terminal

The picker is the one part a test suite never opens, and removal added prompts behind prompts to
it. A pty harness is not needed, and `script` will not take a pipe on its own stdin anyway.
Install a fake stdin **before** anything imports `@clack/prompts` — it binds `node:process`'s
`stdin` at import time, so patching afterwards leaves the prompt listening to the real one:

```ts
const input = new PassThrough();
input.isTTY = true;
input.setRawMode = () => {};
Object.defineProperty(process, 'stdin', { value: input, configurable: true });

const { chooseTarget } = await import('../src/ui/chooseTarget.ts');
```

Then write keys into it — `\u001B[B` down, `' '` to select, `'\r'` to confirm, `'y'` for a
confirm prompt — against a scratch repository, and read back what `chooseTarget` returns. Worth
checking in both layouts, because the initial cursor sits on the enclosing worktree, which is a
different row in each.

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

## The copy

Nobody runs this repository; they run a copy of `src/` sitting in some other
project. That copy is a different environment, and the suite cannot see it:

```sh
mkdir -p /tmp/project/tools/claude-bit
cp -R src/. /tmp/project/tools/claude-bit/
cd /tmp/project && npm init -y && npm install @clack/prompts ansis
cd ~/scratch/repo-feat && node /tmp/project/tools/claude-bit/cli.ts
```

`npm init -y` is the point of that test, not an accident: it writes a
`package.json` with no `"type"`, which makes the project CommonJS. Without
`src/package.json` saying `{ "type": "module" }`, Node parses the copied files
as CommonJS and the first `import` throws `Cannot use import statement outside
a module`. Running the entry point from this repository never shows it,
because the root `package.json` already says `"type": "module"`.

Also worth checking in the copy: that `claude` missing from `PATH` still says
so rather than crashing.

```sh
cd /tmp/scratch && env -i PATH=/usr/bin:/bin "$(command -v node)" \
  /tmp/project/tools/claude-bit/cli.ts
# claude was not found on PATH
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
- [ ] Removal offers neither the main checkout nor the worktree you are standing in
- [ ] A dirty worktree is refused with git's own reason, and the picker reopens showing it
- [ ] A refused removal leaves the worktree alone; nothing ever passes `--force`
- [ ] Each worktree keeps one colour across runs, in the picker and in the terminal
- [ ] The cursor colour is sent only to a TTY, and handed back when Claude exits
- [ ] `NO_COLOR` leaves the picker's labels plain
- [ ] Create and remove brighten and show their hint when the cursor lands on them
- [ ] Creating a worktree prints every type above the name prompt, and accepts a name without one
- [ ] A typed worktree is vivid, a freely named one quiet; only an empty name is refused
- [ ] A worktree's colour follows its type, from the directory name or the branch; untyped is grey
- [ ] Session colours read as distinct on a dark terminal, and survive a 256-colour one
- [ ] A copy of `src/` runs from a project that is CommonJS and has never seen this repository
