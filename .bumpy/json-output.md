---
chromascope: minor
---

Add `--json` to `diff`. It prints exactly one JSON document on stdout, and no progress, so scripts and coding agents can read the result without parsing text.

The document has a `schemaVersion` (`1`), the run ID, URL, base browser, capture options, absolute paths of the screenshots and diff images (`null` when nothing was saved), the pixel change and compared size per browser, and capture timings. A failed run prints `{ "schemaVersion": 1, "error": { "code", "message", "hint" } }` instead. The README documents every field.
