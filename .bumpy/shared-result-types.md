---
chromascope: patch
---

The exported result types are tidier. `ErrorResult` types `error.code` as the new `ErrorCode` union of every error code. The shared `CapturedOptions`, `ComparedOptions` and `Timings` types are exported. `Size` is now the one width and height type: `ImageOptions.viewport` uses it, and `Viewport` is a deprecated alias of it. The CLI's output and behaviour don't change.
