---
name: chromascope
description: Capture a web page in real browsers and measure visual change with the chromascope CLI. Use to verify a UI change (CSS, component, layout) did only what was intended, or to check a page renders the same in Chromium, WebKit and Firefox.
---

# Chromascope

Chromascope captures a page in real browsers and reports how much it changed, as a percentage and as a diff image you can look at. Two modes:

- **Before/after comparison** (`snapshot`, then `compare`): the page now against a baseline captured earlier, in the same browser. Use it while making a UI change.
- **Cross-browser diff** (`diff`): one page in several browsers at once, each against the base browser (Chromium by default).

Run it as `chromascope` if installed, else `npx chromascope`. Every command takes `--help`, which lists all flags, defaults, exit codes and error codes. When a first run fails on setup (browsers, Node, output folder), `chromascope doctor` names each broken check and its fix.

## Verify a UI change

1. Make sure the page is served (a dev server URL like `localhost:3000/pricing`; loopback hosts get `http://`).
2. **Before touching the code**, capture the baseline:

   ```bash
   chromascope snapshot localhost:3000/pricing --element .card --json
   ```

   Scope the capture to what you are changing: `--element <selector>` for one component, `--full-page` for the whole page. `--mask <selector>` hides content that changes on every load (timestamps, ads, random avatars); repeat it per selector. Add `--browsers chromium,firefox,webkit` to baseline more than Chromium.
3. Make the change.
4. Compare, with the same URL and `--element` so the baseline name matches:

   ```bash
   chromascope compare localhost:3000/pricing --element .card --json --out /tmp/chromascope-pricing
   ```

   `compare` reuses the baseline's capture options; leave them off. Passing a different value is `CAPTURE_OPTION_CONFLICT`.
5. Read the result (see [Read the JSON](#read-the-json)) and **open the images**: `diffPath`, and `beforePath`/`afterPath` side by side. The percentage tells you how much changed, only the images tell you what. The step is done when you can say, region by region, that every changed area is one you meant to change.
6. Unintended change: fix the code and run step 4 again. The baseline stays put, so iterate as often as needed.
7. Done: delete the baseline with `compare … --clean` (deletes it only when the run exits `0`) or `chromascope clean <name>`. If the user wants to keep the new look as the next "before", use `compare … --update` instead.

To check that a refactor changed nothing, add `--fail-above 0` to `compare`: exit `1` means some pixel moved.

## Check across browsers

```bash
chromascope diff localhost:3000/pricing --json --out /tmp/chromascope-xb --fail-above 1
```

Each entry in `comparisons` is one browser against the base (`--base`, default `chromium`). Some difference between engines is normal (font rendering, anti-aliasing), so look at the diff images before calling a percentage a bug: scattered specks along text edges are rendering noise, a solid block is a layout difference.

`diff` writes no images unless you pass `--out <dir>` (exact folder, overwritten) or `--save-diff` (new run folder). Always pass `--out` when you want to look at the images.

## Read the JSON

`--json` prints exactly one document on stdout; parse stdout only. Branch on its shape:

- **Success**: `comparisons[]`, one entry per browser, with `browser`, `pixelChangePercentage`, `pixelChange` and the absolute `diffPath`. `compare` adds `beforePath`, `afterPath`, the `before`/`after` sizes and `sizeChanged`. When `sizeChanged` is `true`, the added area counts as changed, so a high percentage may just mean the element grew.
- **Failure**: `{ "schemaVersion": 1, "error": { "code", "message", "hint" } }`. Follow the `hint`; it names the fix.

In a diff image, red pixels changed, yellow ones differ only by anti-aliasing, and the faded grey rest is unchanged.

## Exit codes

| Code | Meaning | Next move |
| --- | --- | --- |
| `0` | Within `--fail-above`, or no `--fail-above` given | Still open the images; `0` without `--fail-above` says nothing about the size of the change |
| `1` | A browser is above `--fail-above` | Open the diff images to find what changed |
| `2` | Usage error | Fix the command; the `hint` and `--help` say how |
| `3` | Runtime error | Act on the error code below |

Runtime errors you can fix yourself:

- `BROWSER_NOT_INSTALLED`: run `chromascope install`, then retry.
- `NAVIGATION_FAILED`: the server isn't running or the URL is wrong. Start the dev server or fix the URL.
- `SELECTOR_TIMEOUT`: the `--element` or `--wait-for` selector matched nothing. Check it against the page's markup. Pass `--timeout 10000` to fail faster while you find the right one.
- `BASELINE_NOT_FOUND`: no `snapshot` was taken under this name; the `hint` has the exact `snapshot` command. If you already changed the code, that baseline captures the new state, so tell the user there is no "before" to compare against.
