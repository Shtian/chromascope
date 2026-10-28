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
  options: ImageOptions & {
    browsers: BrowserName[];
    threshold: number;
    /** The `--fail-above` percentage, or `null` when not given. */
    failAbove: number | null;
    timeout: number;
  };
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

export type Size = { width: number; height: number };

/** One browser's capture compared against its own baseline. */
export type CompareComparison = {
  browser: BrowserName;
  pixelChange: number;
  /** Percentage of the compared canvas: the largest width and height of the before and after images. */
  pixelChangePercentage: number;
  before: Size;
  after: Size;
  /** Whether the before and after images differ in size. The added area counts as changed. */
  sizeChanged: boolean;
  /** Absolute paths of the images in the run folder. */
  beforePath: string;
  afterPath: string;
  diffPath: string;
};

/** The result of `chromascope compare`, as printed by `--json`. */
export type CompareResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  command: "compare";
  runId: string;
  /** The baseline name. */
  name: string;
  /** Absolute path of the folder with this name's baselines. */
  baselineDir: string;
  url: string;
  options: ImageOptions & {
    browsers: BrowserName[];
    threshold: number;
    failAbove: number | null;
    timeout: number;
  };
  /** Absolute path of the run folder with the before, after and diff images. */
  artifactsDir: string;
  comparisons: CompareComparison[];
  /** Whether `--update` saved this capture as the new baseline. */
  updated: boolean;
  /** Whether `--clean` deleted the baseline after the comparison passed. */
  cleaned: boolean;
  timings: { totalMs: number; captureMs: Partial<Record<BrowserName, number>> };
};

/** The result of `chromascope snapshot`, as printed by `--json`. */
export type SnapshotResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  command: "snapshot";
  /** The baseline name. */
  name: string;
  /** Absolute path of the folder with this name's baselines. */
  baselineDir: string;
  url: string;
  options: ImageOptions & { browsers: BrowserName[]; timeout: number };
  /** Absolute path of each browser's baseline image. */
  baselines: Partial<Record<BrowserName, string>>;
  capturedAt: string;
  timings: { totalMs: number; captureMs: Partial<Record<BrowserName, number>> };
};

/** The result of `chromascope clean`, as printed by `--json`. */
export type CleanResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  command: "clean";
  /** Absolute path of the folder that was deleted, or `null` when there was nothing to delete. */
  removed: string | null;
};
