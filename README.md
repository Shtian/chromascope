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
  diff <url>  Diff the URL in chromium, firefox, and webkit. Using chromium as the base.
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
  -e, --element <selector>     Diff only the element with the given selector
  -f, --full-page              Take a full page screenshot
  -v, --verbose                Show more output
  -c, --cookie <cookie>        Add one or more cookies to the context. Format: key=value;key2=value2
  -s, --save-diff              Save the screenshots and diffs as png in a new run folder inside --folder
  -t, --threshold <threshold>  Set the threshold for the diff (default: 0.2)
  -o, --folder <folder>        Set the base folder for chromascope runs (default: chromascope-runs)
  --out <dir>                  Save the screenshots and diffs as png in exactly this folder, without a run folder
  -h, --help                   Display this message
```

#### Artifacts

By default nothing is written to disk. To keep the screenshots and diffs:

- `-s, --save-diff` writes them to a new run folder, `<folder>/<run ID>`. The run ID is the local date and time plus a random suffix, like `20261028160312-a1b2c3`, so concurrent runs never share a folder.
- `--out <dir>` writes them to exactly `<dir>`, creating it if needed and overwriting earlier files. Use it when you need a predictable path, for example in scripts or coding agents.

Chromascope prints the absolute path of every file it writes. The file names are stable:

| File                        | Contents                          |
| --------------------------- | --------------------------------- |
| `chromium.png`              | Chromium screenshot (the base)    |
| `webkit.png`, `firefox.png` | WebKit and Firefox screenshots    |
| `diff-chromium-webkit.png`  | Pixel diff of Chromium vs WebKit  |
| `diff-chromium-firefox.png` | Pixel diff of Chromium vs Firefox |
