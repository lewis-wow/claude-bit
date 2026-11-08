# GitHub

The repository is <https://github.com/lewis-wow/claude-bit> — public, and the
canonical home of this code.

## What the repository is used for

- **Source of truth.** `main` is the branch; there is no release branch.
- **Distribution before npm.** The package is not on a registry yet, so the
  repository is the distribution channel. The supported way to run it is the
  tarball CI builds and attaches to the latest release:

  ```sh
  npx https://github.com/lewis-wow/claude-bit/releases/latest/download/claude-bit.tgz
  ```

  Both `npx` and `pnpm dlx` accept a tarball URL — verified, not assumed. Note
  that `npx <local tarball path>` does _not_ work: npx treats an existing path
  as a command to execute rather than a package to install.

  `npx github:lewis-wow/claude-bit` still works for unreleased `main`, and builds on the
  user's machine via `prepare` — which is why `prepare` must keep working even
  though a tarball install never calls it.

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
  [verifying.md](verifying.md). The repository is public, so a broken `main`
  breaks `npx github:lewis-wow/claude-bit` for anyone who runs it.
- `dist/` is generated and git-ignored. It reaches users through `prepare` on
  a git install, or through the packed tarball on a registry install. Do not
  commit it.
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

The second command currently matches only the title-template `{token}`
concept. Anything else deserves a second look before it becomes public.

## CI

Two workflows, both in `.github/workflows/`.

**`ci.yml`** runs on every push and pull request to `main`:

| Job     | What it does                                                            |
| ------- | ----------------------------------------------------------------------- |
| `check` | format, lint, typecheck, test, build — then packs and uploads a tarball |
| `smoke` | downloads that tarball and runs it through `npx`, in a real worktree    |

The `smoke` job is the point. The `check` job proves the source is healthy;
`smoke` proves the thing a user actually downloads works, which is a different
claim — see [verifying.md](verifying.md) for why that gap keeps producing bugs.
It builds a throwaway git repository with a linked worktree, points `command`
at a stub so no real Claude is launched, and asserts on the working directory
and the generated `--name`.

**`pages.yml`** runs on every push to `main` and publishes GitHub Pages at
<https://lewis-wow.github.io/claude-bit/>: the generated `schema.json` plus a
small page listing the options. It regenerates the schema and fails on
`git diff --exit-code`, so a stale committed schema cannot reach the site.
That URL is what `claude-bit.json` files point their `$schema` at, which is
why it must stay stable.

**`release.yml`** runs on a `v*` tag: full check, pack, then a GitHub Release
carrying both the versioned tarball and a stable `claude-bit.tgz`. That stable
name is what makes `releases/latest/download/claude-bit.tgz` a durable URL.

Cutting a release:

```sh
pnpm version patch      # or minor / major — creates the commit and tag
git push --follow-tags
```

## Not set up yet

Worth knowing these are absent rather than assuming they exist:

- **No publish to npm from CI.** `release.yml` attaches a tarball; it does not
  run `pnpm publish`. That needs an npm token and is a deliberate choice.
- **No matrix across Node versions.** CI runs the version in `.nvmrc` only,
  though 22, 24 and 26 are verified by hand.
- **No branch protection** on `main`.
