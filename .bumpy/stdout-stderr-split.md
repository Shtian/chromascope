---
chromascope: major
---

Print results on stdout and everything else on stderr, so the output of `diff` can be piped into other tools.

- **Breaking:** `--verbose` debug output now goes to stderr instead of stdout.
- **Breaking:** when stdout isn't a terminal, or `CI`, `NO_COLOR` or `--quiet` is set, results are plain text, one line per comparison: `webkit 0.12% 1104px /abs/path/diff-chromium-webkit.png`. The decorated output with emoji stays for interactive terminals.
- Progress is plain text without spinners or emoji when stderr isn't a terminal, or under `CI` or `NO_COLOR`.
- New `-q, --quiet` flag silences progress. Errors still print.
- `chromascope install` prints its progress on stderr.
