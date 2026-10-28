# AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`Shtian/chromascope`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Development

- **Done gate**: `pnpm run ci` (lint, typecheck, unit tests with coverage thresholds, build). Coverage thresholds in `vitest.config.ts` are strict, so new logic in `src/` ships with a co-located `*.test.ts`. That file also lists the glue files excluded from coverage.
- **Lint fixes**: `pnpm exec biome check --write .` fixes formatting and import order together; `pnpm format` only fixes formatting.
- **Browser tests**: `pnpm test:integration` sits outside `ci` and runs real browsers plus the built CLI. Run it when changing `src/commands/`, `src/lib/browser.ts`, or CLI flags. First run needs `pnpm exec playwright install chromium firefox webkit`. CLI help text is snapshotted: update with `pnpm test:integration -u`.
- **Bump file**: any change to `src/` or `package.json` needs a bump file in `.bumpy/`, or the pre-push hook and the `bump-file` CI job fail. Its message becomes the `CHANGELOG.md` entry, so write it for users. Commands are in `CONTRIBUTING.md`.
