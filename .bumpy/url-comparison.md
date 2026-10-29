---
chromascope: minor
---

Add `chromascope versus <before-url> <after-url>` (alias `vs`) to run a URL comparison: both URLs are captured in each browser, and each browser's capture of the second URL is compared against its capture of the first. Use it to compare production with a local build without taking a baseline first.

- Both URLs use the same capture options, and one `--cookie` list is set for whichever URL is captured.
- Like `compare`, it writes `before-`, `after-` and `diff-<browser>.png` to a run folder (`--folder`, or exactly `--out`), and supports `--threshold`, `--fail-above` and `--json`.
- The JSON has `"command": "versus"`, `beforeUrl` and `afterUrl`. Its TypeScript type is the new `VersusResult`.
