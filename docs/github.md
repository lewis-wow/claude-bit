# GitHub

The repository is <https://github.com/lewis-wow/claude-bit> — public, and the
canonical home of this code.

## What the repository is used for

- **Source of truth.** `main` is the branch; there is no release branch.
- **Distribution before npm.** The package is not on a registry yet, so the
  repository _is_ the distribution channel. `npx github:lewis-wow/claude-bit`
  clones it, runs `prepare` to build `dist/`, and executes — which is why
  `prepare` must keep working even though a registry install never calls it.
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
git ls-files | grep -v package-lock
git grep -nIE "token|secret|password|api[_-]?key|BEGIN .*PRIVATE" -- . ':!package-lock.json'
```

The second command currently matches only the title-template `{token}`
concept. Anything else deserves a second look before it becomes public.

## Not set up yet

Worth knowing these are absent rather than assuming they exist:

- **No CI workflow.** Nothing runs `npm run check` on push; it is a local gate
  only. A workflow running the check on Node 22, 24 and 26 would match what is
  verified by hand today.
- **No releases or tags.** Version lives only in `package.json`.
- **No branch protection** on `main`.
