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

### Commands

```bash
$ chromascope --help
chromascope/x.x.x

Usage:
  $ chromascope <command> [options]

Commands:
  diff <url>  Diff the URL in chromium, firefox, and webkit. Using chromium as the base.

For more info, run any command with the `--help` flag:
  $ chromascope diff --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

#### Diff

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
  -s, --save-diff              Save generated diff as png
  -t, --threshold <threshold>  Set the threshold for the diff (default: 0.2)
  -f, --folder <folder>        Set the base folder for chromascope runs (default: chromascope-runs)
  -h, --help                   Display this message
```
