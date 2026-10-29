# Chromascope reference

Every command, flag, output format, exit code and error code. For what chromascope is for and the flows it enables, see the [README](../README.md).

## Commands

```bash
$ chromascope --help
chromascope/x.x.x

Usage:
  $ chromascope <command> [options]

Commands:
  diff <url>                       Capture the URL in several browsers and compare each against the base browser
  snapshot <url>                   Capture a baseline of the URL for a later compare
  compare [url]                    Capture the URL again and compare each browser against its baseline
  versus <before-url> <after-url>  Run a URL comparison: compare the second URL against the first in each browser
  clean [name]                     Delete the baseline with this name, or every baseline
  doctor                           Check that Node, the browsers and the output folder are ready for chromascope
  install                          Install the chromium, firefox, and webkit browsers used by chromascope

For more info, run any command with the `--help` flag:
  $ chromascope diff --help
  $ chromascope snapshot --help
  $ chromascope compare --help
  $ chromascope versus --help
  $ chromascope clean --help
  $ chromascope doctor --help
  $ chromascope install --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number

Exit codes:
  0  Success: every comparison is within --fail-above, or no --fail-above was given, or compare --update
  1  At least one comparison is above --fail-above
  2  Usage error: unknown command or option, missing or invalid argument
  3  Runtime error: navigation failed, selector not found, timeout, browser or baseline missing,
     or a doctor check failed

Error codes:
  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,
                    INVALID_SELECTOR, CAPTURE_OPTION_CONFLICT
  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, BASELINE_NOT_FOUND,
                    BASELINE_INVALID, UNKNOWN_ERROR
```

### Diff

A URL without a scheme gets `https://`, except for loopback hosts (`localhost`, `*.localhost`, `127.x.x.x` and `[::1]`), which get `http://`. So `chromascope diff localhost:3000` diffs `http://localhost:3000/`. Pass the scheme explicitly to override this.

```bash
$ chromascope diff --help
chromascope/x.x.x

Usage:
  $ chromascope diff <url>

Options:
  --browsers <list>            Comma separated browsers to capture (default: chromium,webkit,firefox)
  -e, --element <selector>     Capture only the element with the given selector
  -f, --full-page              Take a full page screenshot
  --viewport <size>            Viewport size as <width>x<height> (default: 1280x720)
  --device-scale-factor <n>    Device scale factor, like 2 for retina screenshots (default: 1)
  --timeout <ms>               Milliseconds each navigation, wait and capture may take (default: 30000)
  --wait-for <selector>        Wait for the selector to be visible before capturing
  --wait-until <event>         Page load event to wait for: load, domcontentloaded or networkidle (default: load)
  --mask <selector>            Hide the elements matching the selector. Repeat it to mask more
  -c, --cookie <cookie>        Add one or more cookies to the context. Format: key=value;key2=value2
  -v, --verbose                Print debug output on stderr
  -q, --quiet                  Print no progress on stderr. Errors still print
  --json                       Print the result, or the error, as one JSON document on stdout
  -t, --threshold <threshold>  Set the threshold for the diff (default: 0.2)
  --fail-above <percent>       Exit with 1 when a browser's pixel change is above this percentage
  --base <browser>             Browser the others are compared against (default: chromium)
  -s, --save-diff              Save the screenshots and diffs as png in a new run folder inside --folder
  -o, --folder <folder>        Set the base folder for chromascope runs (default: chromascope-runs)
  --out <dir>                  Save the screenshots and diffs as png in exactly this folder, without a run folder
  -h, --help                   Display this message

Examples:
  $ chromascope diff localhost:3000
  $ chromascope diff localhost:3000/pricing --element .card --browsers chromium,webkit
  $ chromascope diff https://example.com --save-diff
  $ chromascope diff localhost:3000 --json --out /tmp/diff --fail-above 1

Exit codes:
  0  Success: every comparison is within --fail-above, or no --fail-above was given, or compare --update
  1  At least one comparison is above --fail-above
  2  Usage error: unknown command or option, missing or invalid argument
  3  Runtime error: navigation failed, selector not found, timeout, browser or baseline missing,
     or a doctor check failed

Error codes:
  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,
                    INVALID_SELECTOR, CAPTURE_OPTION_CONFLICT
  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, BASELINE_NOT_FOUND,
                    BASELINE_INVALID, UNKNOWN_ERROR
```

### Output

Results go to stdout, and nothing else does. Progress, debug output (`-v, --verbose`) and errors go to stderr, so you can pipe the results into other tools.

In a terminal, chromascope shows spinners and decorated results with emoji. When stdout isn't a terminal, or `CI`, `NO_COLOR` or `--quiet` is set, it prints one plain line per comparison instead: the browser, the pixel change percentage, the changed pixels and, when saved, the absolute path of the diff image.

```
webkit 0.12% 1104px /home/me/app/chromascope-runs/20261028160312-a1b2c3/diff-chromium-webkit.png
firefox 0.00% 0px /home/me/app/chromascope-runs/20261028160312-a1b2c3/diff-chromium-firefox.png
```

Progress on stderr is plain too, one line per step. `-q, --quiet` silences progress completely; errors still print.

### JSON output

`--json` prints exactly one JSON document on stdout, and no progress on stderr. The result of `diff` looks like this:

```json
{
  "schemaVersion": 1,
  "command": "diff",
  "runId": "20261028160312-a1b2c3",
  "url": "http://localhost:3000/",
  "base": "chromium",
  "options": {
    "browsers": ["chromium", "webkit", "firefox"],
    "element": null,
    "fullPage": false,
    "viewport": { "width": 1280, "height": 720 },
    "deviceScaleFactor": 1,
    "waitFor": null,
    "waitUntil": "load",
    "mask": [],
    "threshold": 0.2,
    "failAbove": null,
    "timeout": 30000
  },
  "artifactsDir": "/home/me/app/chromascope-runs/20261028160312-a1b2c3",
  "screenshots": {
    "chromium": "/home/me/app/chromascope-runs/20261028160312-a1b2c3/chromium.png",
    "webkit": "/home/me/app/chromascope-runs/20261028160312-a1b2c3/webkit.png",
    "firefox": "/home/me/app/chromascope-runs/20261028160312-a1b2c3/firefox.png"
  },
  "comparisons": [
    {
      "browser": "webkit",
      "pixelChange": 1104,
      "pixelChangePercentage": 0.12,
      "width": 1280,
      "height": 720,
      "diffPath": "/home/me/app/chromascope-runs/20261028160312-a1b2c3/diff-chromium-webkit.png"
    }
  ],
  "timings": { "totalMs": 4210, "captureMs": { "chromium": 1830, "webkit": 2410, "firefox": 3950 } }
}
```

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Version of this shape. Adding fields doesn't change it. Renaming or removing a field bumps it in a major release. |
| `command` | The command that produced the document. |
| `runId` | Unique ID of the run, also the name of its run folder. |
| `url` | The URL that was captured, with the scheme chromascope picked. |
| `base` | The base browser every comparison is measured against. |
| `options` | The capture options, threshold and `--fail-above` used. Cookies are left out. |
| `artifactsDir` | Absolute path of the folder with the images, or `null` when nothing was saved. |
| `screenshots` | Absolute path of each browser's screenshot, or `null` when nothing was saved. |
| `comparisons` | One entry per browser: changed pixels, their percentage of the compared size, that size, and the diff image (`null` when not saved). |
| `timings` | Milliseconds for the whole run and for each browser's capture. |

When a run fails, `--json` prints an error object instead:

```json
{ "schemaVersion": 1, "error": { "code": "INVALID_URL", "message": "…", "hint": "…" } }
```

The package ships TypeScript types for these documents. Import them as types; the package has no runtime API:

```ts
import type { CompareResult, DiffResult, ErrorResult } from "chromascope";

const result: DiffResult | ErrorResult = JSON.parse(stdout);
```

It exports `DiffResult`, `CompareResult`, `VersusResult`, `SnapshotResult`, `CleanResult`, `DoctorResult` and `ErrorResult`, the per-browser `DiffComparison` and `CompareComparison`, the per-check `DoctorCheck`, the shared `CapturedOptions`, `ComparedOptions` and `Timings`, and `SchemaVersion`, `ErrorCode`, `BrowserName`, `ImageOptions`, `WaitUntil` and `Size`. `Viewport` is a deprecated alias of `Size`.

### Exit codes and errors

| Code | Meaning |
| --- | --- |
| `0` | Success: every comparison is within `--fail-above`, or no `--fail-above` was given. `compare --update` always exits `0` |
| `1` | At least one comparison is above `--fail-above` |
| `2` | Usage error: unknown command or option, missing or invalid argument |
| `3` | Runtime error: navigation failed, selector not found, timeout, browser missing, or a `doctor` check failed |

`--fail-above <percent>` makes `diff` exit `1` when any browser's pixel change percentage is above the value, so a CI job or agent can gate on visual drift. `--fail-above 0` fails on any change.

Every error prints a stable code, a message and a hint on stderr. Playwright's call log only prints with `--verbose`.

```
error[SELECTOR_TIMEOUT]: no element matched "#nope" within 30s
hint: check the selector, or raise the timeout with --timeout
```

| Error code | Exit | Meaning |
| --- | --- | --- |
| `INVALID_URL` | `2` | The URL isn't an http(s) URL with a host |
| `INVALID_OPTION` | `2` | An unknown option, or an option with a missing or invalid value |
| `INVALID_ARGUMENT` | `2` | An argument the command doesn't take |
| `MISSING_ARGUMENT` | `2` | A required argument, like the URL, is missing |
| `UNKNOWN_COMMAND` | `2` | No command has this name |
| `INVALID_SELECTOR` | `2` | `--element` or `--wait-for` isn't a valid selector |
| `CAPTURE_OPTION_CONFLICT` | `2` | `compare` got an image option that differs from the baseline's |
| `BROWSER_NOT_INSTALLED` | `3` | A browser is missing. Run `chromascope install` |
| `NAVIGATION_FAILED` | `3` | The page didn't load, or not within `--timeout` |
| `SELECTOR_TIMEOUT` | `3` | No element matched `--element` or `--wait-for` within `--timeout` |
| `BASELINE_NOT_FOUND` | `3` | `compare` found no baseline for the name or a browser. The hint has the `snapshot` command to run |
| `BASELINE_INVALID` | `3` | A baseline's metadata can't be read. Run `snapshot` again |
| `UNKNOWN_ERROR` | `3` | Anything else. Run again with `--verbose` for details |

### Capture options

These flags control how the page is captured, so runs are fast and repeatable. `diff`, `snapshot`, `compare` and `versus` share them:

- `--browsers <list>` captures only these browsers, like `--browsers chromium,firefox`. `--base <browser>` picks the browser the others are compared against (default `chromium`). The base browser is always captured.
- `--viewport <width>x<height>` (default `1280x720`) and `--device-scale-factor <n>` (default `1`) set the page size. A device scale factor of `2` doubles the screenshot's pixel size.
- `--timeout <ms>` limits every navigation, wait and capture (default `30000`). Use a short timeout to fail fast on a wrong `--element` selector.
- `--wait-until <load|domcontentloaded|networkidle>` picks the page load event to wait for (default `load`), and `--wait-for <selector>` also waits for an element to be visible.
- `-e, --element <selector>` captures only the first matching element, and `-f, --full-page` captures the whole page instead of the viewport.
- `--mask <selector>` hides the matching elements behind a solid box, for parts that change on every load like timestamps or ads. Repeat it to mask several.

Every capture waits for web fonts, disables CSS animations and transitions, and hides the text caret, so an unchanged page captures the same way every time.

### Artifacts

By default nothing is written to disk. To keep the screenshots and diffs:

- `-s, --save-diff` writes them to a new run folder, `<folder>/<run ID>`. The run ID is the local date and time plus a random suffix, like `20261028160312-a1b2c3`, so concurrent runs never share a folder.
- `--out <dir>` writes them to exactly `<dir>`, creating it if needed and overwriting earlier files. Use it when you need a predictable path, for example in scripts or coding agents.

Every printed artifact path is absolute. The file names are stable, so the screenshots sit next to the diff images:

| File                        | Contents                                                                          |
| --------------------------- | --------------------------------------------------------------------------------- |
| `<browser>.png`             | Screenshot of each captured browser, like `chromium.png`                          |
| `diff-<base>-<browser>.png` | Pixel diff of a browser against the base browser, like `diff-chromium-webkit.png` |

## Doctor

`chromascope doctor` checks that chromascope can run: that the Node version matches `engines.node` in `package.json`, that Playwright can launch each browser, and that the output folder (`--folder`, default `chromascope-runs`) can be created and written. It writes nothing to disk. It prints one line per check, with a fix for each failed check, and exits `3` if any check fails:

```
$ chromascope doctor
ok node: node 24.0.0, needs >=24
ok chromium: chromium launches
ok webkit: webkit launches
fail firefox: firefox is not installed (fix: run `chromascope install` to install the browsers)
ok folder: /home/me/app/chromascope-runs is writable
```

`--browsers <list>` checks only some browsers. `--json` prints `{ "schemaVersion": 1, "command": "doctor", "ok", "checks": [{ "name", "ok", "message", "fix" }] }`, where `fix` is `null` for a passing check. Its TypeScript type is `DoctorResult`.

## Verify a UI change

`snapshot`, `compare` and `clean` check what a UI change did to a page, in the same browser. They're made for a local development session, by you or a coding agent: capture the page, change some CSS or a component, and confirm that only what you meant to change changed.

1. Capture a baseline before the change:

   ```bash
   chromascope snapshot localhost:3000/pricing --element .card
   ```

   This stores `.chromascope/baselines/localhost-3000_pricing__card/chromium.png` plus a `metadata.json` with the URL and image options. The baseline name is derived from the URL's host, port and path and from `--element`; pass `--name` to pick your own. Chromascope also writes `.chromascope/.gitignore`, so baselines are never committed.

2. Make the UI change.

3. Compare the page against its baseline:

   ```bash
   chromascope compare localhost:3000/pricing --element .card --fail-above 0
   ```

   ```
   chromium 2.17% 434px 200x100->200x100 same-size /home/me/app/chromascope-runs/20261028160312-a1b2c3/diff-chromium.png
   ```

   Without a terminal, `compare` prints one plain line per browser: the browser, the pixel change percentage, the changed pixels, the before and after size as `<width>x<height>-><width>x<height>`, `same-size` or `size-changed`, and the absolute path of the diff image. In a terminal, each browser's box shows the same before and after size and whether it changed.

   `compare` captures the page again with the image options stored in the baseline and compares each browser against its own baseline. It exits `0` when the change is within `--fail-above` (or without it), `1` above it. Every run writes `before-<browser>.png`, `after-<browser>.png` and `diff-<browser>.png` to a run folder (`--folder`, or exactly `--out`), so you can look at what changed. Use `--json` for the full result, including each browser's before and after size and a `sizeChanged` flag.

4. Accept the new look, or clean up:

   ```bash
   chromascope compare localhost:3000/pricing --element .card --update   # save the new capture as the baseline
   chromascope compare localhost:3000/pricing --element .card --clean    # delete the baseline once the comparison passes
   chromascope clean                                                     # delete every baseline
   ```

Things to know:

- `snapshot` captures Chromium by default. Pass `--browsers chromium,firefox` to capture more. A bare `compare` compares every browser in the baseline, and `--browsers` picks some of them.
- `snapshot` always replaces an existing baseline with the same name. `compare` never creates one: without a baseline it exits `3` with `BASELINE_NOT_FOUND` and the exact `snapshot` command to run, with the capture options you gave `compare`. When only a browser is missing, the command recaptures every browser with the baseline's stored image options, so `compare` runs without a conflict afterwards.
- With `--name`, `compare` can leave out the URL and captures the one stored in the baseline.
- `compare` reuses the baseline's viewport, device scale factor, element, full page, waits and masks. Passing one of them with a different value is a usage error (`CAPTURE_OPTION_CONFLICT`, exit `2`); run `snapshot` again, or accept the new capture with `compare --update`, which stores the new options too and drops the browsers it didn't capture. `--cookie`, `--timeout`, `--threshold` and `--fail-above` can always be changed.
- `--mask <selector>` hides dynamic parts of the page, like timestamps or ads, behind a solid box. Repeat it to mask several. It works for `diff` too.
- When the page changes size, the smaller image is padded, so the added area counts as changed.
- `--baseline-dir <dir>` stores the baselines somewhere else. Pass it to `snapshot`, `compare` and `clean` alike. Any `.chromascope` folder chromascope creates on the way, like for `--baseline-dir .chromascope/other`, gets a `.gitignore` too. Chromascope never edits your project's own `.gitignore`.
- `clean` only deletes baselines, never run folders.

The `compare` JSON uses the same versioned envelope as `diff`, with `"command": "compare"`. On top of the run ID, URL, capture options and timings, it has the baseline `name` and `baselineDir`, the run folder as `artifactsDir`, `updated` and `cleaned`, and per browser `pixelChange`, `pixelChangePercentage`, `before` and `after` sizes, `sizeChanged`, and absolute `beforePath`, `afterPath` and `diffPath`. Its TypeScript type is `CompareResult`, next to `SnapshotResult` and `CleanResult`: `import type { CompareResult } from "chromascope"`.

```bash
$ chromascope snapshot --help
chromascope/x.x.x

Usage:
  $ chromascope snapshot <url>

Options:
  --browsers <list>          Comma separated browsers to capture (default: chromium)
  -e, --element <selector>   Capture only the element with the given selector
  -f, --full-page            Take a full page screenshot
  --viewport <size>          Viewport size as <width>x<height> (default: 1280x720)
  --device-scale-factor <n>  Device scale factor, like 2 for retina screenshots (default: 1)
  --timeout <ms>             Milliseconds each navigation, wait and capture may take (default: 30000)
  --wait-for <selector>      Wait for the selector to be visible before capturing
  --wait-until <event>       Page load event to wait for: load, domcontentloaded or networkidle (default: load)
  --mask <selector>          Hide the elements matching the selector. Repeat it to mask more
  -c, --cookie <cookie>      Add one or more cookies to the context. Format: key=value;key2=value2
  -v, --verbose              Print debug output on stderr
  -q, --quiet                Print no progress on stderr. Errors still print
  --json                     Print the result, or the error, as one JSON document on stdout
  --baseline-dir <dir>       Folder the baselines are stored in (default: .chromascope/baselines)
  --name <name>              Baseline name (default: derived from the URL and --element)
  -h, --help                 Display this message

Examples:
  $ chromascope snapshot localhost:3000/pricing --element .card
  $ chromascope snapshot localhost:3000 --browsers chromium,firefox --mask .timestamp

Exit codes:
  0  Success: every comparison is within --fail-above, or no --fail-above was given, or compare --update
  1  At least one comparison is above --fail-above
  2  Usage error: unknown command or option, missing or invalid argument
  3  Runtime error: navigation failed, selector not found, timeout, browser or baseline missing,
     or a doctor check failed

Error codes:
  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,
                    INVALID_SELECTOR, CAPTURE_OPTION_CONFLICT
  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, BASELINE_NOT_FOUND,
                    BASELINE_INVALID, UNKNOWN_ERROR
```

```bash
$ chromascope compare --help
chromascope/x.x.x

Usage:
  $ chromascope compare [url]

Options:
  --browsers <list>            Comma separated browsers to capture (default: every browser of the baseline)
  -e, --element <selector>     Capture only the element with the given selector (default: the baseline's)
  -f, --full-page              Take a full page screenshot (default: the baseline's)
  --viewport <size>            Viewport size as <width>x<height> (default: the baseline's)
  --device-scale-factor <n>    Device scale factor, like 2 for retina screenshots (default: the baseline's)
  --timeout <ms>               Milliseconds each navigation, wait and capture may take (default: 30000)
  --wait-for <selector>        Wait for the selector to be visible before capturing (default: the baseline's)
  --wait-until <event>         Page load event to wait for: load, domcontentloaded or networkidle (default: the baseline's)
  --mask <selector>            Hide the elements matching the selector. Repeat it to mask more (default: the baseline's)
  -c, --cookie <cookie>        Add one or more cookies to the context. Format: key=value;key2=value2
  -v, --verbose                Print debug output on stderr
  -q, --quiet                  Print no progress on stderr. Errors still print
  --json                       Print the result, or the error, as one JSON document on stdout
  -t, --threshold <threshold>  Set the threshold for the diff (default: 0.2)
  --fail-above <percent>       Exit with 1 when a browser's pixel change is above this percentage
  --baseline-dir <dir>         Folder the baselines are stored in (default: .chromascope/baselines)
  --name <name>                Baseline name. Without a URL, the baseline's URL is captured (default: derived from the URL and --element)
  --update                     Save the new capture as the baseline after comparing. Always exits with 0
  --clean                      Delete the baseline when the comparison exits with 0
  -o, --folder <folder>        Set the base folder for chromascope runs (default: chromascope-runs)
  --out <dir>                  Save the before, after and diff images in exactly this folder, without a run folder
  -h, --help                   Display this message

Examples:
  $ chromascope compare localhost:3000/pricing --element .card --fail-above 0
  $ chromascope compare --name homepage --json
  $ chromascope compare localhost:3000/pricing --element .card --update

Exit codes:
  0  Success: every comparison is within --fail-above, or no --fail-above was given, or compare --update
  1  At least one comparison is above --fail-above
  2  Usage error: unknown command or option, missing or invalid argument
  3  Runtime error: navigation failed, selector not found, timeout, browser or baseline missing,
     or a doctor check failed

Error codes:
  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,
                    INVALID_SELECTOR, CAPTURE_OPTION_CONFLICT
  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, BASELINE_NOT_FOUND,
                    BASELINE_INVALID, UNKNOWN_ERROR
```

```bash
$ chromascope clean --help
chromascope/x.x.x

Usage:
  $ chromascope clean [name]

Options:
  -v, --verbose         Print debug output on stderr
  -q, --quiet           Print no progress on stderr. Errors still print
  --json                Print the result, or the error, as one JSON document on stdout
  --baseline-dir <dir>  Folder the baselines are stored in (default: .chromascope/baselines)
  -h, --help            Display this message

Exit codes:
  0  Success: every comparison is within --fail-above, or no --fail-above was given, or compare --update
  1  At least one comparison is above --fail-above
  2  Usage error: unknown command or option, missing or invalid argument
  3  Runtime error: navigation failed, selector not found, timeout, browser or baseline missing,
     or a doctor check failed

Error codes:
  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,
                    INVALID_SELECTOR, CAPTURE_OPTION_CONFLICT
  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, BASELINE_NOT_FOUND,
                    BASELINE_INVALID, UNKNOWN_ERROR
```

## Compare two URLs

`versus` (alias `vs`) runs a URL comparison: it captures two URLs in each browser and compares each browser's capture of the second URL against its capture of the first. Use it when the "before" is already served somewhere, like production, so there is nothing to `snapshot`:

```bash
chromascope versus https://example.com/pricing localhost:3000/pricing --element .card --fail-above 0
```

```
chromium 2.17% 434px 200x100->200x100 same-size /home/me/app/chromascope-runs/20261028160312-a1b2c3/diff-chromium.png
webkit 2.17% 434px 200x100->200x100 same-size /home/me/app/chromascope-runs/20261028160312-a1b2c3/diff-webkit.png
firefox 2.17% 434px 200x100->200x100 same-size /home/me/app/chromascope-runs/20261028160312-a1b2c3/diff-firefox.png
```

- The first URL is always "before" and the second "after". Browsers are never compared with each other. Chromium, WebKit and Firefox run by default; `--browsers` picks some of them.
- Both URLs are captured with the same capture options. There are no per-URL flags. `--cookie` takes one list and sets it for whichever URL is captured, so the same cookies reach both hosts.
- It never reads or writes baselines, so `--name`, `--update`, `--clean` and `--baseline-dir` don't exist here.
- Everything else works like `compare`: the plain output, `before-`, `after-` and `diff-<browser>.png` in a run folder (`--folder`, or exactly `--out`), `--threshold`, and `--fail-above` with the same exit codes.

The `--json` document uses the same envelope as `compare`, with `"command": "versus"`, `beforeUrl` and `afterUrl` instead of `url`, and none of `name`, `baselineDir`, `updated` or `cleaned`. Each browser's `timings.captureMs` adds up both of its captures. Its TypeScript type is `VersusResult`.

```bash
$ chromascope versus --help
chromascope/x.x.x

Usage:
  $ chromascope versus <before-url> <after-url>

Options:
  --browsers <list>            Comma separated browsers to capture (default: chromium,webkit,firefox)
  -e, --element <selector>     Capture only the element with the given selector
  -f, --full-page              Take a full page screenshot
  --viewport <size>            Viewport size as <width>x<height> (default: 1280x720)
  --device-scale-factor <n>    Device scale factor, like 2 for retina screenshots (default: 1)
  --timeout <ms>               Milliseconds each navigation, wait and capture may take (default: 30000)
  --wait-for <selector>        Wait for the selector to be visible before capturing
  --wait-until <event>         Page load event to wait for: load, domcontentloaded or networkidle (default: load)
  --mask <selector>            Hide the elements matching the selector. Repeat it to mask more
  -c, --cookie <cookie>        Add one or more cookies to the context. Format: key=value;key2=value2
  -v, --verbose                Print debug output on stderr
  -q, --quiet                  Print no progress on stderr. Errors still print
  --json                       Print the result, or the error, as one JSON document on stdout
  -t, --threshold <threshold>  Set the threshold for the diff (default: 0.2)
  --fail-above <percent>       Exit with 1 when a browser's pixel change is above this percentage
  -o, --folder <folder>        Set the base folder for chromascope runs (default: chromascope-runs)
  --out <dir>                  Save the before, after and diff images in exactly this folder, without a run folder
  -h, --help                   Display this message

Examples:
  $ chromascope versus https://example.com localhost:3000 --fail-above 0
  $ chromascope vs https://example.com/pricing localhost:3000/pricing --element .card --browsers chromium,webkit
  $ chromascope versus https://example.com localhost:3000 --cookie session=abc --json --out /tmp/versus

Exit codes:
  0  Success: every comparison is within --fail-above, or no --fail-above was given, or compare --update
  1  At least one comparison is above --fail-above
  2  Usage error: unknown command or option, missing or invalid argument
  3  Runtime error: navigation failed, selector not found, timeout, browser or baseline missing,
     or a doctor check failed

Error codes:
  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,
                    INVALID_SELECTOR, CAPTURE_OPTION_CONFLICT
  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, BASELINE_NOT_FOUND,
                    BASELINE_INVALID, UNKNOWN_ERROR
```
