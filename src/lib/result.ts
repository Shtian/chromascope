import type { BrowserName, ImageOptions } from "./capture-options";

/**
 * Version of the `--json` document. Adding fields doesn't change it.
 * Renaming or removing fields bumps it, and needs a major release.
 */
export const SCHEMA_VERSION = 1;

/** One browser compared against the base browser in a cross-browser diff. */
export type DiffComparison = {
  browser: BrowserName;
  pixelChange: number;
  pixelChangePercentage: number;
  /** Size of the compared canvas: the largest width and height of the two screenshots. */
  width: number;
  height: number;
  /** Absolute path of the diff image, or `null` when artifacts weren't saved. */
  diffPath: string | null;
};

/** The result of `chromascope diff`, as printed by `--json`. */
export type DiffResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  command: "diff";
  runId: string;
  url: string;
  base: BrowserName;
  options: ImageOptions & { browsers: BrowserName[]; threshold: number; timeout: number };
  /** Absolute path of the folder with the screenshots and diffs, or `null` when artifacts weren't saved. */
  artifactsDir: string | null;
  /** Absolute path of each browser's screenshot, or `null` when artifacts weren't saved. */
  screenshots: Partial<Record<BrowserName, string | null>>;
  comparisons: DiffComparison[];
  timings: { totalMs: number; captureMs: Partial<Record<BrowserName, number>> };
};

/** What `--json` prints when a command fails. */
export type ErrorResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  error: { code: string; message: string; hint: string };
};
