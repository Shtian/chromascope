---
chromascope: minor
---

Add `chromascope doctor`, which checks the Node version, that Playwright can launch each browser, and that the output folder is writable. It prints one line per check with a fix for each failed check, supports `--json` and `--browsers`, and exits `3` if any check fails.

`diff`, `snapshot` and `compare` now show examples in their `--help`. Running `chromascope` without a command prints the help instead of nothing.
