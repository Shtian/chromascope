import type { BrowserName } from "./capture-options";
import type { ErrorCode } from "./error-codes";
import type { ImageOptions, Size } from "./image-options";

/**
 * Version of the `--json` document. Adding fields doesn't change it.
 * Renaming or removing fields bumps it, and needs a major release.
 */
export const SCHEMA_VERSION = 1;

/** The capture options a result records: the image options, the browsers and the timeout. */
export type CapturedOptions = ImageOptions & { browsers: BrowserName[]; timeout: number };

/** The options a comparison result records: the capture options and how pixels were compared. */
export type ComparedOptions = CapturedOptions & {
  threshold: number;
  /** The `--fail-above` percentage, or `null` when not given. */
  failAbove: number | null;
};

export type Timings = {
  /** Milliseconds the whole command took. */
  totalMs: number;
  /** Milliseconds each browser's capture took. */
  captureMs: Partial<Record<BrowserName, number>>;
};

/** A value per item, keyed by the item's browser, in the items' order. */
export const byBrowser = <Item extends { browser: BrowserName }, Value>(
  items: Item[],
  value: (item: Item) => Value,
): Partial<Record<BrowserName, Value>> =>
  Object.fromEntries(items.map((item) => [item.browser, value(item)])) as Partial<Record<BrowserName, Value>>;

/** The time since `started`, and each browser's capture time. */
export const timingsOf = (
  started: number,
  captures: Array<{ browser: BrowserName; ms: number }>,
  now: number = performance.now(),
): Timings => ({ totalMs: Math.round(now - started), captureMs: byBrowser(captures, ({ ms }) => ms) });

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
  options: ComparedOptions;
  /** Absolute path of the folder with the screenshots and diffs, or `null` when artifacts weren't saved. */
  artifactsDir: string | null;
  /** Absolute path of each browser's screenshot, or `null` when artifacts weren't saved. */
  screenshots: Partial<Record<BrowserName, string | null>>;
  comparisons: DiffComparison[];
  timings: Timings;
};

/** What `--json` prints when a command fails. */
export type ErrorResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  error: { code: ErrorCode; message: string; hint: string };
};

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
  options: ComparedOptions;
  /** Absolute path of the run folder with the before, after and diff images. */
  artifactsDir: string;
  comparisons: CompareComparison[];
  /** Whether `--update` saved this capture as the new baseline. */
  updated: boolean;
  /** Whether `--clean` deleted the baseline after the comparison passed. */
  cleaned: boolean;
  timings: Timings;
};

/** The result of `chromascope versus`, a URL comparison, as printed by `--json`. */
export type VersusResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  command: "versus";
  runId: string;
  /** The first URL, captured as "before". */
  beforeUrl: string;
  /** The second URL, captured as "after" and compared against the first. */
  afterUrl: string;
  options: ComparedOptions;
  /** Absolute path of the run folder with the before, after and diff images. */
  artifactsDir: string;
  comparisons: CompareComparison[];
  /** Each browser's `captureMs` is the time both of its captures took. */
  timings: Timings;
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
  options: CapturedOptions;
  /** Absolute path of each browser's baseline image. */
  baselines: Partial<Record<BrowserName, string>>;
  capturedAt: string;
  timings: Timings;
};

/** One check of `chromascope doctor`. */
export type DoctorCheck = {
  /** What was checked: `node`, a browser name, or `folder`. */
  name: string;
  ok: boolean;
  message: string;
  /** How to fix a failed check, or `null` when it passed. */
  fix: string | null;
};

/** The result of `chromascope doctor`, as printed by `--json`. */
export type DoctorResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  command: "doctor";
  /** Whether every check passed. */
  ok: boolean;
  checks: DoctorCheck[];
};

/** The result of `chromascope clean`, as printed by `--json`. */
export type CleanResult = {
  schemaVersion: typeof SCHEMA_VERSION;
  command: "clean";
  /** Absolute path of the folder that was deleted, or `null` when there was nothing to delete. */
  removed: string | null;
};
