# Chromascope

![npm](https://img.shields.io/npm/v/chromascope) ![GitHub Workflow Status (with branch)](https://img.shields.io/github/actions/workflow/status/shtian/chromascope/main.yml?branch=main)

Chromascope is a tool for visualizing the diff of a given URL between chromium, webkit, and firefox. It uses Playwright to capture the screenshots and pixelmatch to compare them.

## Usage

```bash
$ npx chromascope --help

Usage:
  $ index.js <command> [options]

Commands:
  diff <url>  Diff the URL in chromium, firefox, and webkit. Using chromium as the base.

For more info, run any command with the `--help` flag:
  $ index.js diff --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

### Commands

#### Diff

```bash
$ npx chromascope diff --help

Usage:
  $ npx chromascope diff <url>

Options:
  -v, --verbose                Show more output
  -s, --save-diff              Save generated diff as png
  -t, --threshold <threshold>  Set the threshold for the diff (default: 0.1)
  -f, --folder <folder>        Set the base folder for chromascope runs (default: chromascope-runs)
  -h, --help                   Display this message
```
