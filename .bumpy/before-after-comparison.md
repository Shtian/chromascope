---
chromascope: minor
---

Add `snapshot`, `compare` and `clean` to check what a UI change did to a page, in the same browser.

- `chromascope snapshot <url>` captures a baseline (Chromium by default, or `--browsers`) and stores it in `.chromascope/baselines/<name>/`, with a `.chromascope/.gitignore` so it's never committed. The name is derived from the URL and `--element`, or set with `--name`.
- `chromascope compare [url]` captures the page again with the baseline's capture options and compares each browser against its baseline. It writes `before-`, `after-` and `diff-<browser>.png` to a run folder, prints the pixel change and the before and after size, and supports `--fail-above` and `--json`. `--update` saves the new capture as the baseline, and `--clean` deletes the baseline once the comparison passes. A missing baseline exits `3` with the `snapshot` command to run, and a capture option that differs from the baseline's exits `2`.
- `chromascope clean [name]` deletes one baseline, or all of them.
- `--baseline-dir <dir>` stores the baselines somewhere else.
- New `--mask <selector>` capture option, for `diff` too, hides dynamic parts of the page like timestamps or ads.

The README has a "Verify a UI change" walkthrough.
