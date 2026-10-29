import type { SCHEMA_VERSION } from "./lib/result";

/**
 * The public types of chromascope's `--json` output, for package consumers:
 * `import type { DiffResult } from "chromascope"`. Types only, nothing runs.
 */
export type {
  BrowserName,
  ImageOptions,
  Size,
  Viewport,
  WaitUntil,
} from "./lib/capture-options";
export type { ErrorCode } from "./lib/error-codes";
export type {
  CapturedOptions,
  CleanResult,
  CompareComparison,
  ComparedOptions,
  CompareResult,
  DiffComparison,
  DiffResult,
  DoctorCheck,
  DoctorResult,
  ErrorResult,
  SnapshotResult,
  Timings,
} from "./lib/result";

/** The `schemaVersion` of every `--json` document. */
export type SchemaVersion = typeof SCHEMA_VERSION;
