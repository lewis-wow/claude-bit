# GitHub

The repository is <https://github.com/lewis-wow/claude-bit> — public, and the
canonical home of this code.

## What the repository is used for

- **Source of truth.** `main` is the branch; there is no release branch.
- **Something to copy.** Nothing is published and nothing is run from here at
  run time. People take `src/` and paste it into their own project, so the
  repository's job is to hold a copy worth taking — see
  [conventions.md](conventions.md).

- **Issues and pull requests** at `/issues` and `/pulls`.

## Working with it from the command line

Use the `gh` CLI rather than the web UI; it is already authenticated here.

```sh
gh repo view --web          # open the repository
gh issue list
gh issue create --title "..." --body "..."
gh pr create --fill         # from a feature branch
gh pr checks                # CI status for the current branch
gh run list --limit 5       # recent workflow runs
gh run watch                # follow the run in progress
gh run view --log-failed    # logs for the steps that failed
gh release list
```

Pushing:

```sh
git push origin main
```

## Rules of engagement

- Never commit to `main` without the full check passing — see
  [verifying.md](verifying.md). The repository is public, and `main` is what
  people copy.
- Nothing is generated: what is in `src/` is what people take. There is no
  build output to keep out of the tree.
- The repository is public: everything pushed is world-readable and may be
  cached or indexed even if later removed. Check before pushing — see the scan
  in the next section.
- Commits are authored as `lewis-wow <ludvik.prokopec@gmail.com>`, which is
  visible on every public commit. GitHub's `noreply` address is the way to
  hide it, if that is ever wanted.

## Before pushing something new

```sh
git ls-files | grep -v pnpm-lock
git grep -nIE "token|secret|password|api[_-]?key|BEGIN .*PRIVATE" -- . ':!pnpm-lock.yaml'
```

The second command currently matches only its own listing in this file.
Anything else deserves a second look before it becomes public.

## CI

One workflow, `.github/workflows/ci.yml`, on every push and pull request to
`main`.

| Job     | What it does                                                |
| ------- | ----------------------------------------------------------- |
| `check` | format, lint, typecheck, test                               |
| `copy`  | copies `src/` into a scratch project and runs it from there |

The `copy` job is the point. `check` proves the source is healthy; `copy`
proves the thing people actually use — a folder pasted into someone else's
project — works, which is a different claim. It runs `npm init -y`, so the
host project is CommonJS and the copy has to carry its own module type; it
installs the two dependencies and nothing else; it stubs `claude` on `PATH` so
nothing real is launched; and it asserts on the working directory, the
generated `--name`, and the message when `claude` is missing entirely.

## Not set up yet

Worth knowing these are absent rather than assuming they exist:

- **No releases, tags or npm publishing.** The distribution model is copying,
  so there is no release workflow and `package.json` is `private`.
- **No matrix across Node versions.** CI runs the version in `.nvmrc` only,
  though 22, 24 and 26 are verified by hand.
- **No branch protection** on `main`.
