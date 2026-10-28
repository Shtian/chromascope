---
chromascope: major
---

Give exit codes a documented meaning, and make every error actionable.

- **Breaking:** failures no longer exit `1`. Usage errors (unknown command or option, missing or invalid argument) exit `2`, and runtime errors (page didn't load, selector not found, timeout, browser missing) exit `3`.
- New `--fail-above <percent>` flag: `diff` exits `1` when any browser's pixel change percentage is above the value. Without it, a successful run always exits `0`.
- **Breaking:** errors print a stable code, a message and a hint on stderr, like `error[SELECTOR_TIMEOUT]: no element matched "#nope" within 30s` followed by `hint: …`. Playwright's call log only prints with `--verbose`. With `--json`, the same code, message and hint are in the JSON error object.
- An unknown command is now an error instead of doing nothing.
- `--help` and the README list the exit codes and error codes.
