# Contributing

## Setup

```bash
pnpm install
pnpm run ci   # lint, test, build
```

`pnpm install` also installs a pre-push git hook that checks your branch has a bump file.

## Releases

Releases are managed with [bumpy](https://bumpy.varlock.dev). Every PR that changes `src/` or `package.json` needs a **bump file** in `.bumpy/` describing the change and its semver level:

```bash
pnpm bumpy add --packages "chromascope:patch" --message "Fix cookie parsing"
pnpm bumpy add --empty --name "ci-tweaks"   # the change needs no release
```

What happens next:

1. On each PR, the `bump-file` CI job fails if a bump file is missing and comments with the release plan. PRs from forks don't get the comment, because their token is read-only.
2. When a PR merges to `main`, the Release workflow opens or updates a **Version Packages** PR. This PR bumps `package.json`, updates `CHANGELOG.md`, and deletes the consumed bump files.
3. When the Version Packages PR merges, the Release workflow publishes to npm, tags the release, and creates a GitHub release.

Run `pnpm bumpy status` to preview the pending release.

### Publishing setup (maintainers)

Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) with provenance, so no `NPM_TOKEN` is needed. On npmjs.com, go to package settings → Trusted Publisher → GitHub Actions and set:

- Repository: `Shtian/chromascope`
- Workflow: `bumpy-release.yml`
- Environment: `publish`

After the first successful trusted publish, delete the old `NPM_TOKEN` repository secret.

Optional: add a `BUMPY_GH_TOKEN` repository secret. It must be a fine-grained PAT with read/write access to Contents and Pull requests on this repo. Without it, CI won't run on the Version Packages PR, because GitHub doesn't trigger workflows for PRs opened with the default token.
