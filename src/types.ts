import type { SCHEMA_VERSION } from "./lib/result";

/**
 * The public types of chromascope's `--json` output, for package consumers:
 * `import type { DiffResult } from "chromascope"`. Types only, nothing runs.
 */
export type {
  BrowserName,
  ImageOptions,
  Viewport,
  WaitUntil,
} from "./lib/capture-options";
export type {
  CleanResult,
  CompareComparison,
  CompareResult,
  DiffComparison,
  DiffResult,
  ErrorResult,
  Size,
  SnapshotResult,
} from "./lib/result";

/** The `schemaVersion` of every `--json` document. */
export type SchemaVersion = typeof SCHEMA_VERSION;
