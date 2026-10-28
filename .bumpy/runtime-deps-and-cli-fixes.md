---
chromascope: major
---

Upgrade runtime dependencies and fix CLI bugs.

- **Breaking:** `--folder` now uses `-o` as its short flag. `-f` is only `--full-page`.
- **Breaking:** browsers are no longer downloaded on install. Run `chromascope install` once to install Chromium, Firefox, and WebKit; a missing browser now fails with a message pointing to it.
- **Breaking:** pixelmatch 8 uses a more accurate color metric, so pixel change counts differ from earlier versions.
- `--threshold` must be a number between 0 and 1.
- Browsers are closed after each run.
- Cleaning up the run folder no longer crashes on Node 26.
- Depend on `playwright` only, dropping `@playwright/test` and the `playwright-core` peer dependency. Upgrade `cac` to 7, `ora` to 9, and `pixelmatch` to 8.
