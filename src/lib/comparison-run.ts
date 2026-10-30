import path from "node:path";
import { PNG } from "pngjs";
import type { BrowserName, CaptureOptions } from "./capture-options";
import { type Capture, type Capturer, captureAll } from "./capturer";
import { compareImages } from "./image";
import { pickImageOptions } from "./image-options";
import output from "./output";
import {
  byBrowser,
  type CompareComparison,
  type ComparedOptions,
  type DiffComparison,
  SCHEMA_VERSION,
  type Timings,
  timingsOf,
} from "./result";
import { openRun, type Run, type RunFolderOptions } from "./run";
import { exceedsFailAbove } from "./utils";

/** Where each browser's "before" image comes from. The page at `url` is always the "after". */
export type BeforeSource =
  /** A cross-browser diff: the base browser's capture of the same page. Writes artifacts only when `save` is set. */
  | { kind: "base-browser"; base: BrowserName; save: boolean }
  /** A before/after comparison: the browser's baseline image. */
  | { kind: "baseline"; image: (browser: BrowserName) => Buffer }
  /** A URL comparison: the browser's capture of the first URL. */
  | { kind: "url"; url: string };

export type ComparisonRunInput<Command extends string, Fields extends object, Source extends BeforeSource> = {
  /** The command the result is for. */
  command: Command;
  /** The command's own result fields, which follow the run ID. */
  fields: Fields;
  /** The page captured as "after". */
  url: string;
  before: Source;
  capture: CaptureOptions;
  threshold: number;
  /** A comparison above this pixel change percentage sets `aboveFailAbove`. `null` never does. */
  failAbove: number | null;
  run: RunFolderOptions;
};

type CrossBrowserArtifacts = {
  /** Absolute path of the run folder, or `null` when artifacts weren't saved. */
  artifactsDir: string | null;
  /** Absolute path of each browser's screenshot, or `null` when artifacts weren't saved. */
  screenshots: Partial<Record<BrowserName, string | null>>;
  comparisons: DiffComparison[];
};

type BeforeAfterArtifacts = {
  /** Absolute path of the run folder with the before, after and diff images. */
  artifactsDir: string;
  comparisons: CompareComparison[];
};

type ArtifactsOf<Source extends BeforeSource> = Source extends { kind: "base-browser" }
  ? CrossBrowserArtifacts
  : BeforeAfterArtifacts;

export type ComparisonRun<Command extends string, Fields extends object, Source extends BeforeSource> = {
  /** The result, with the fields `diff`, `compare` and `versus` share around the command's own. */
  result: { schemaVersion: typeof SCHEMA_VERSION; command: Command; runId: string } & Fields & {
      options: ComparedOptions;
    } & ArtifactsOf<Source> & { timings: Timings };
  /** Each browser's capture of `url`. */
  captures: Capture[];
  /** Whether a comparison is above `--fail-above`. */
  aboveFailAbove: boolean;
};

/**
 * Runs a comparison: captures `url` in every browser, compares each capture against its "before" image, writes the
 * images to a run folder and builds the result. Nothing is written until every capture succeeded.
 */
export const runComparison = async <Command extends string, Fields extends object, Source extends BeforeSource>(
  input: ComparisonRunInput<Command, Fields, Source>,
  capturer: Capturer,
): Promise<ComparisonRun<Command, Fields, Source>> => {
  const started = performance.now();
  const { before, capture, threshold, failAbove } = input;
  const browsers = before.kind === "base-browser" ? baseFirst(before.base, capture.browsers) : capture.browsers;
  const run = openRun(input.run);
  output.debug(`Run ID: ${run.runId}`);

  const compared =
    before.kind === "base-browser"
      ? await crossBrowserDiff(input, before, browsers, run, capturer)
      : await beforeAfter(input, before, run, capturer);

  const result = {
    schemaVersion: SCHEMA_VERSION,
    command: input.command,
    runId: run.runId,
    ...input.fields,
    options: { ...pickImageOptions(capture), browsers, threshold, failAbove, timeout: capture.timeout },
    ...compared.artifacts,
    timings: timingsOf(started, compared.timed),
  };
  return {
    result: result as ComparisonRun<Command, Fields, Source>["result"],
    captures: compared.captures,
    aboveFailAbove: exceedsFailAbove(compared.artifacts.comparisons, failAbove),
  };
};

/** The browsers with the base browser first. The base is always captured. */
const baseFirst = (base: BrowserName, browsers: BrowserName[]) => [
  base,
  ...browsers.filter((browser) => browser !== base),
];

type Input = ComparisonRunInput<string, object, BeforeSource>;

/** The artifacts, each browser's capture of `url`, and the captures to time. */
type Compared<Artifacts> = {
  artifacts: Artifacts;
  captures: Capture[];
  /** The captures timed in the result: each browser's, or both of its captures in a URL comparison. */
  timed: Array<{ browser: BrowserName; ms: number }>;
};

/**
 * Compares every browser against the base browser. Writes `<browser>.png` and `diff-<base>-<browser>.png` only when
 * `save` or `--out` is set, so without them the run folder is never created.
 */
const crossBrowserDiff = async (
  { url, capture, threshold, run: runFolder }: Input,
  { base, save }: { base: BrowserName; save: boolean },
  browsers: BrowserName[],
  run: Run,
  capturer: Capturer,
): Promise<Compared<CrossBrowserArtifacts>> => {
  const saving = save || runFolder.out !== undefined;
  if (saving) output.debug(`Run folder: ${run.dir}`);
  const write = (name: string, image: Buffer) => {
    if (!saving) return null;
    output.debug(`Saving ${name} to ${run.pathOf(name)}`);
    return run.write(name, image);
  };

  const captures = await captureAll(capturer, browsers, url, { ...capture, browsers });
  const [baseCapture, ...others] = captures;
  const baseImage = PNG.sync.read(baseCapture.image);

  const screenshots = byBrowser(captures, ({ browser, image }) => write(`${browser}.png`, image));
  const comparisons = others.map(({ browser, image }): DiffComparison => {
    const { pixelChange, pixelChangePercentage, diff } = compareImages(baseImage, PNG.sync.read(image), threshold);
    const diffPath = write(`diff-${base}-${browser}.png`, PNG.sync.write(diff));
    return { browser, pixelChange, pixelChangePercentage, width: diff.width, height: diff.height, diffPath };
  });

  return {
    artifacts: { artifactsDir: saving ? run.dir : null, screenshots, comparisons },
    captures,
    timed: captures,
  };
};

/** Compares each browser's capture against its baseline or its capture of the first URL. */
const beforeAfter = async (
  { url, capture, threshold }: Input,
  before: Exclude<BeforeSource, { kind: "base-browser" }>,
  run: Run,
  capturer: Capturer,
): Promise<Compared<BeforeAfterArtifacts>> => {
  output.debug(`Run folder: ${run.dir}`);
  const { browsers } = capture;
  let pairs: Pair[];
  let captures: Capture[];
  if (before.kind === "url") {
    output.info(`Before: ${before.url}`);
    const beforeCaptures = await captureAll(capturer, browsers, before.url, capture);
    output.info(`After: ${url}`);
    captures = await captureAll(capturer, browsers, url, capture);
    pairs = pairCaptures(beforeCaptures, captures);
  } else {
    captures = await captureAll(capturer, browsers, url, capture);
    pairs = captures.map(({ browser, image, ms }) => ({ browser, before: before.image(browser), after: image, ms }));
  }

  const comparisons = pairs.map((pair) => {
    const { comparison, files } = compareBeforeAfter(pair.browser, pair.before, pair.after, run.dir, threshold);
    for (const [file, data] of files) run.write(file, data);
    return comparison;
  });
  return { artifacts: { artifactsDir: run.dir, comparisons }, captures, timed: pairs };
};

type Pair = { browser: BrowserName; before: Buffer; after: Buffer; ms: number };

/**
 * Pairs each browser's capture of the before URL with the same browser's capture of the after URL, in the order of the
 * before captures. A URL comparison never compares across browsers. `ms` is the time both captures took.
 */
export const pairCaptures = (before: Capture[], after: Capture[]): Pair[] =>
  before.map(({ browser, image, ms }) => {
    const other = after.find((capture) => capture.browser === browser);
    if (!other) throw new Error(`${browser} has no capture of the after URL`);
    return { browser, before: image, after: other.image, ms: ms + other.ms };
  });

/**
 * Compares a browser's after capture against its before capture: the baseline in a before/after comparison, or the
 * first URL in a URL comparison. Returns the comparison and the before, after and diff images to write to the run
 * folder, by file name. File names are stable.
 */
export const compareBeforeAfter = (
  browser: BrowserName,
  before: Buffer,
  after: Buffer,
  runFolder: string,
  threshold: number,
) => {
  const names = { before: `before-${browser}.png`, after: `after-${browser}.png`, diff: `diff-${browser}.png` };
  const beforeImage = PNG.sync.read(before);
  const afterImage = PNG.sync.read(after);
  const { pixelChange, pixelChangePercentage, diff } = compareImages(beforeImage, afterImage, threshold);

  const comparison: CompareComparison = {
    browser,
    pixelChange,
    pixelChangePercentage,
    before: { width: beforeImage.width, height: beforeImage.height },
    after: { width: afterImage.width, height: afterImage.height },
    sizeChanged: beforeImage.width !== afterImage.width || beforeImage.height !== afterImage.height,
    beforePath: path.join(runFolder, names.before),
    afterPath: path.join(runFolder, names.after),
    diffPath: path.join(runFolder, names.diff),
  };
  const files: Array<[string, Buffer]> = [
    [names.before, before],
    [names.after, after],
    [names.diff, PNG.sync.write(diff)],
  ];
  return { comparison, files };
};
