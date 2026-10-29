# HTML report

Chromascope doesn't generate an HTML report or any other visual review page for its results.

## Why this is out of scope

Chromascope is a CLI for scripts, CI jobs and coding agents. A run's outputs are the before, after and diff PNGs in the run folder and the `--json` result. Agents read both directly, and so can a human: the run folder opens in any editor or file browser.

A report page would be the only HTML, CSS and JavaScript in the codebase, and it would serve only humans. It would have to keep up with every kind of comparison: the cross-browser diff, the before/after comparison and the URL comparison. Each one has its own images and result shape. That maintenance cost buys little that the PNGs don't already give.

Anyone who wants a visual review can build one from the `--json` output, which has absolute paths to every image:

```bash
chromascope compare http://localhost:3000/pricing --json | your-report-tool
```

## When to revisit

Revisit this if humans start running chromascope directly and ask for a better way to review results. Consider an `--open` flag first, which would open the run folder or diff images in the system viewer, before a full report.

## Prior requests

- #67: "Before/after comparison: HTML report with before/after/diff slider"
