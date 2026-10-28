# Chromascope

![chromascope_21x9](https://user-images.githubusercontent.com/468796/229309522-1e79d197-9016-4eb1-bb25-585cfbc11e8b.jpg)

![npm](https://img.shields.io/npm/v/chromascope) ![GitHub Workflow Status (with branch)](https://img.shields.io/github/actions/workflow/status/shtian/chromascope/main.yml?branch=main)

Chromascope is a tool for visualizing the diff of a given URL between chromium, webkit, and firefox. It uses Playwright to capture the screenshots and pixelmatch to compare them.

## Usage

Can be installed globally with pnpm|npm|yarn:

```bash
pnpm add -g chromascope
npm i -g chromascope
yarn global add chromascope
```

or run it directly with npx:

```bash
npx chromascope <command> [options]
```

Chromascope needs the Chromium, Firefox, and WebKit browsers from Playwright. Install them once before your first diff:

```bash
chromascope install
```

### Commands

```bash
$ chromascope --help
chromascope/x.x.x

Usage:
  $ chromascope <command> [options]

Commands:
  diff <url>  Capture the URL in several browsers and compare each against the base browser
  install     Install the chromium, firefox, and webkit browsers used by chromascope

For more info, run any command with the `--help` flag:
  $ chromascope diff --help
  $ chromascope install --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

#### Diff

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
  -c, --cookie <cookie>        Add one or more cookies to the context. Format: key=value;key2=value2
  --base <browser>             Browser the others are compared against (default: chromium)
  -v, --verbose                Show more output
  -s, --save-diff              Save the screenshots and diffs as png in a new run folder inside --folder
  -t, --threshold <threshold>  Set the threshold for the diff (default: 0.2)
  -o, --folder <folder>        Set the base folder for chromascope runs (default: chromascope-runs)
  --out <dir>                  Save the screenshots and diffs as png in exactly this folder, without a run folder
  -h, --help                   Display this message
```

#### Capture options

These flags control how the page is captured, so runs are fast and repeatable:

- `--browsers <list>` captures only these browsers, like `--browsers chromium,firefox`. `--base <browser>` picks the browser the others are compared against (default `chromium`). The base browser is always captured.
- `--viewport <width>x<height>` (default `1280x720`) and `--device-scale-factor <n>` (default `1`) set the page size. A device scale factor of `2` doubles the screenshot's pixel size.
- `--timeout <ms>` limits every navigation, wait and capture (default `30000`). Use a short timeout to fail fast on a wrong `--element` selector.
- `--wait-until <load|domcontentloaded|networkidle>` picks the page load event to wait for (default `load`), and `--wait-for <selector>` also waits for an element to be visible.
- `-e, --element <selector>` captures only the first matching element, and `-f, --full-page` captures the whole page instead of the viewport.

Every capture waits for web fonts, disables CSS animations and transitions, and hides the text caret, so an unchanged page captures the same way every time.

#### Artifacts

By default nothing is written to disk. To keep the screenshots and diffs:

- `-s, --save-diff` writes them to a new run folder, `<folder>/<run ID>`. The run ID is the local date and time plus a random suffix, like `20261028160312-a1b2c3`, so concurrent runs never share a folder.
- `--out <dir>` writes them to exactly `<dir>`, creating it if needed and overwriting earlier files. Use it when you need a predictable path, for example in scripts or coding agents.

Chromascope prints the absolute path of every file it writes. The file names are stable:

| File                        | Contents                                                                          |
| --------------------------- | --------------------------------------------------------------------------------- |
| `<browser>.png`             | Screenshot of each captured browser, like `chromium.png`                          |
| `diff-<base>-<browser>.png` | Pixel diff of a browser against the base browser, like `diff-chromium-webkit.png` |
