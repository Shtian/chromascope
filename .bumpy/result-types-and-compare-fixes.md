---
chromascope: minor
---

Export the `--json` result types, and polish `compare`.

- The package now ships TypeScript types for the `--json` documents: `import type { DiffResult, CompareResult, ErrorResult } from "chromascope"`. Types only; the package still has no runtime API.
- `compare` always shows each browser's before and after size. In a terminal, the box says whether the size changed. The plain line has a `same-size` or `size-changed` marker after the sizes: `chromium 0.00% 0px 1280x720->1280x720 same-size <diff path>`.
- When `compare` has no baseline, the hint is the exact `snapshot` command to run, with every capture option you gave `compare` (viewport, device scale factor, element, full page, waits and masks), safely quoted. When only a browser is missing, it recaptures every browser with the baseline's stored options, so `compare` works right after.
- `--baseline-dir .chromascope/other` now writes `.chromascope/.gitignore` too, whenever chromascope creates a `.chromascope` folder.
- The `compare` hint for a missing URL now talks about the baseline instead of a snapshot.
