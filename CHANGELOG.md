# chromascope



## 2.0.1
<sub>2026-10-29</sub>

- *(patch)*
  Describe chromascope as a tool for coding agents to check their own UI changes, with agent-related npm keywords, and move the full command reference to docs/reference.md.

## 2.0.0
<sub>2026-10-29</sub>

- *(major)*
  Ship an ESM-only build via tsdown. The broken `main`, `module` and `exports` fields are removed; chromascope is a CLI and is used through its `bin`.
- *(major)*
  Upgrade runtime dependencies and fix CLI bugs.

  - **Breaking:** `--folder` now uses `-o` as its short flag. `-f` is only `--full-page`.
  - **Breaking:** browsers are no longer downloaded on install. Run `chromascope install` once to install Chromium, Firefox, and WebKit; a missing browser now fails with a message pointing to it.
  - **Breaking:** pixelmatch 8 uses a more accurate color metric, so pixel change counts differ from earlier versions.
  - `--threshold` must be a number between 0 and 1.
  - Browsers are closed after each run.
  - Cleaning up the run folder no longer crashes on Node 26.
  - Depend on `playwright` only, dropping `@playwright/test` and the `playwright-core` peer dependency. Upgrade `cac` to 7, `ora` to 9, and `pixelmatch` to 8.
- *(major)*
  URLs without a scheme for loopback hosts (`localhost`, `*.localhost`, `127.x.x.x` and `[::1]`) now default to `http://` instead of `https://`, so `chromascope diff localhost:3000` works against a local dev server. Other hosts still default to `https://`.
- *(major)*
  Make run artifacts safe to use from scripts and coding agents.

  - **Breaking:** run IDs now end in a random suffix (`20261028160312-a1b2c3`), so two runs started in the same second no longer overwrite each other or delete each other's folder. The run folder is created exclusively and a collision fails loudly.
  - **Breaking:** printed artifact paths are absolute, and `--save-diff` output also lists the Chromium, WebKit and Firefox screenshots.
  - New `--out <dir>` flag writes the screenshots and diffs to exactly that folder, without a run ID subfolder, even without `--save-diff`.
  - The artifact file names `<browser>.png` and `diff-chromium-<browser>.png` are now documented as stable.
- *(major)*
  Print results on stdout and everything else on stderr, so the output of `diff` can be piped into other tools.

  - **Breaking:** `--verbose` debug output now goes to stderr instead of stdout.
  - **Breaking:** when stdout isn't a terminal, or `CI`, `NO_COLOR` or `--quiet` is set, results are plain text, one line per comparison: `webkit 0.12% 1104px /abs/path/diff-chromium-webkit.png`. The decorated output with emoji stays for interactive terminals.
  - Progress is plain text without spinners or emoji when stderr isn't a terminal, or under `CI` or `NO_COLOR`.
  - New `-q, --quiet` flag silences progress. Errors still print.
  - `chromascope install` prints its progress on stderr.
- *(major)*
  Give exit codes a documented meaning, and make every error actionable.

  - **Breaking:** failures no longer exit `1`. Usage errors (unknown command or option, missing or invalid argument) exit `2`, and runtime errors (page didn't load, selector not found, timeout, browser missing) exit `3`.
  - New `--fail-above <percent>` flag: `diff` exits `1` when any browser's pixel change percentage is above the value. Without it, a successful run always exits `0`.
  - **Breaking:** errors print a stable code, a message and a hint on stderr, like `error[SELECTOR_TIMEOUT]: no element matched "#nope" within 30s` followed by `hint: …`. Playwright's call log only prints with `--verbose`. With `--json`, the same code, message and hint are in the JSON error object.
  - An unknown command is now an error instead of doing nothing.
  - `--help` and the README list the exit codes and error codes.
- *(major)* Requires Node 24 or later. Node 22 is no longer supported.
- *(minor)*
  Add capture options to `diff` for fast, repeatable runs.

  - `--browsers <list>` captures only the listed browsers, and `--base <browser>` picks the browser the others are compared against. Diff images are named `diff-<base>-<browser>.png`.
  - `--viewport <width>x<height>` and `--device-scale-factor <n>` set the page size.
  - `--timeout <ms>` limits every navigation, wait and capture, so a wrong `--element` selector fails fast.
  - `--wait-until <load|domcontentloaded|networkidle>` and `--wait-for <selector>` wait until the page is ready before capturing.
  - Captures wait for web fonts, disable animations and hide the text caret, so an unchanged page captures the same way every time.
  - `--element` now captures the first matching element instead of failing when the selector matches several.
- *(minor)*
  Add `--json` to `diff`. It prints exactly one JSON document on stdout, and no progress, so scripts and coding agents can read the result without parsing text.

  The document has a `schemaVersion` (`1`), the run ID, URL, base browser, capture options, absolute paths of the screenshots and diff images (`null` when nothing was saved), the pixel change and compared size per browser, and capture timings. A failed run prints `{ "schemaVersion": 1, "error": { "code", "message", "hint" } }` instead. The README documents every field.
- *(minor)*
  Add `snapshot`, `compare` and `clean` to check what a UI change did to a page, in the same browser.

  - `chromascope snapshot <url>` captures a baseline (Chromium by default, or `--browsers`) and stores it in `.chromascope/baselines/<name>/`, with a `.chromascope/.gitignore` so it's never committed. The name is derived from the URL and `--element`, or set with `--name`.
  - `chromascope compare [url]` captures the page again with the baseline's capture options and compares each browser against its baseline. It writes `before-`, `after-` and `diff-<browser>.png` to a run folder, prints the pixel change and the before and after size, and supports `--fail-above` and `--json`. `--update` saves the new capture as the baseline, and `--clean` deletes the baseline once the comparison passes. A missing baseline exits `3` with the `snapshot` command to run, and a capture option that differs from the baseline's exits `2`.
  - `chromascope clean [name]` deletes one baseline, or all of them.
  - `--baseline-dir <dir>` stores the baselines somewhere else.
  - New `--mask <selector>` capture option, for `diff` too, hides dynamic parts of the page like timestamps or ads.

  The README has a "Verify a UI change" walkthrough.
- *(minor)*
  Export the `--json` result types, and polish `compare`.

  - The package now ships TypeScript types for the `--json` documents: `import type { DiffResult, CompareResult, ErrorResult } from "chromascope"`. Types only; the package still has no runtime API.
  - `compare` always shows each browser's before and after size. In a terminal, the box says whether the size changed. The plain line has a `same-size` or `size-changed` marker after the sizes: `chromium 0.00% 0px 1280x720->1280x720 same-size <diff path>`.
  - When `compare` has no baseline, the hint is the exact `snapshot` command to run, with every capture option you gave `compare` (viewport, device scale factor, element, full page, waits and masks), safely quoted. When only a browser is missing, it recaptures every browser with the baseline's stored options, so `compare` works right after.
  - `--baseline-dir .chromascope/other` now writes `.chromascope/.gitignore` too, whenever chromascope creates a `.chromascope` folder.
  - The `compare` hint for a missing URL now talks about the baseline instead of a snapshot.
- *(minor)*
  Add `chromascope doctor`, which checks the Node version, that Playwright can launch each browser, and that the output folder is writable. It prints one line per check with a fix for each failed check, supports `--json` and `--browsers`, and exits `3` if any check fails.

  `diff`, `snapshot` and `compare` now show examples in their `--help`. Running `chromascope` without a command prints the help instead of nothing.
- *(minor)*
  Add `chromascope versus <before-url> <after-url>` (alias `vs`) to run a URL comparison: both URLs are captured in each browser, and each browser's capture of the second URL is compared against its capture of the first. Use it to compare production with a local build without taking a baseline first.

  - Both URLs use the same capture options, and one `--cookie` list is set for whichever URL is captured.
  - Like `compare`, it writes `before-`, `after-` and `diff-<browser>.png` to a run folder (`--folder`, or exactly `--out`), and supports `--threshold`, `--fail-above` and `--json`.
  - The JSON has `"command": "versus"`, `beforeUrl` and `afterUrl`. Its TypeScript type is the new `VersusResult`.
- *(patch)*
  Validate URLs with `URL.canParse`. Only `http` and `https` URLs with a host are accepted, and a URL without a scheme gets `https://` even when the host starts with `http` (like `httpbin.org`).

  Comparing two zero-size screenshots (for example an empty `--element`) reports 0% pixel change instead of `NaN%`.
- *(patch)*
  The exported result types are tidier. `ErrorResult` types `error.code` as the new `ErrorCode` union of every error code. The shared `CapturedOptions`, `ComparedOptions` and `Timings` types are exported. `Size` is now the one width and height type: `ImageOptions.viewport` uses it, and `Viewport` is a deprecated alias of it. The CLI's output and behaviour don't change.

## 1.1.3

### Patch Changes

- c7b79be: Migrating from Rome to Biome

## 1.1.2

### Patch Changes

- 1d4e7b9: Run playwright install as a post install script

## 1.1.1

### Patch Changes

- cd2dd50: Fixes cookieless runs

## 1.1.0

### Minor Changes

- cad9a3b: Add optional cookie option

## 1.0.3

### Patch Changes

- d502d06: Add clearer instructions for usage

## 1.0.2

### Patch Changes

- 16ca368: Refactoring and adding missing package.json fields

## 1.0.1

### Patch Changes

- 6b7c1e9: Fix outdated docs and more specific wording

## 1.0.0

### Major Changes

- d1fa3ea: Fixed diffing of elements and linting/formatting added with Rome

## 0.3.0

### Minor Changes

- 44ae210: Adds support for diffing elements on page, parallelizes the screenshot process and provides better result outputs

## 0.2.0

### Minor Changes

- 335d018: working POC for diffing

## 0.1.2

### Patch Changes

- cde9303: try publishing new release

## 0.1.1

### Patch Changes

- parse url and log it

## 0.1.0

### Minor Changes

- 95ec325: add cli

## 0.0.3

### Patch Changes

- e6ae570: add missing npmignore

## 0.0.2

### Patch Changes

- 5204cf6: initial release
- 2098785: initial release
