import fs from "node:fs";
import { version } from "../../package.json";
import { type BaselineStore, deriveBaselineName } from "../lib/baselines";
import { compareBeforeAfter, planComparison, shouldClean, updatedBaseline } from "../lib/before-after";
import { captureAll } from "../lib/capture";
import type { BrowserName } from "../lib/capture-options";
import type { ImageOptions } from "../lib/image-options";
import output from "../lib/output";
import { byBrowser, type CompareResult, SCHEMA_VERSION, timingsOf } from "../lib/result";
import { openRun, type RunFolderOptions } from "../lib/run";
import { exceedsFailAbove } from "../lib/utils";

/** The capture options passed to `compare`. The image options and browsers that weren't passed come from the baseline. */
export type CompareCaptureOptions = {
  /** The image options passed as flags. Each must match the baseline's, unless `update` is set. */
  imageFlags: Partial<ImageOptions>;
  /** The browsers to compare, or `null` for every browser of the baseline. */
  browsers: BrowserName[] | null;
  timeout: number;
  cookie: string;
};

export type CompareOptions = {
  /** The URL to capture, or `null` for the baseline's URL. */
  url: string | null;
  /** The baseline name, or `null` to derive it from the URL and element. */
  name: string | null;
  capture: CompareCaptureOptions;
  threshold: number;
  failAbove: number | null;
  update: boolean;
  clean: boolean;
  run: RunFolderOptions;
  /** `--baseline-dir` as given, for the snapshot command in the error when the baseline is missing. */
  baselineDir?: string;
};

/**
 * Captures the page again and compares each browser against its own baseline.
 * Resolves to the result and whether a comparison is above `--fail-above`.
 */
export const compare = async (options: CompareOptions, store: BaselineStore) => {
  const started = performance.now();
  const { imageFlags, browsers: browsersFlag, timeout, cookie } = options.capture;
  const name = options.name ?? deriveBaselineName(options.url ?? "", imageFlags.element ?? null);
  const { baseline, url, capture, browsers, conflicts } = planComparison({
    name,
    root: store.root,
    baseline: store.read(name),
    url: options.url,
    nameGiven: options.name !== null,
    imageFlags,
    browsers: browsersFlag,
    update: options.update,
    baselineDir: options.baselineDir,
  });
  const { dir, metadata, imagePath } = baseline;

  const run = openRun(options.run);
  output.debug(`Comparing ${url} against baseline ${dir}, run folder: ${run.dir}`);

  const captures = await captureAll(browsers, url, { ...capture, browsers, timeout, cookie });

  const comparisons = captures.map(({ browser, image }) => {
    const { comparison, files } = compareBeforeAfter(
      browser,
      fs.readFileSync(imagePath(browser)),
      image,
      run.dir,
      options.threshold,
    );
    for (const [file, data] of files) run.write(file, data);
    return comparison;
  });
  const aboveFailAbove = exceedsFailAbove(comparisons, options.failAbove);

  if (options.update) {
    const updated = updatedBaseline({
      stored: metadata,
      compared: browsers,
      conflicted: conflicts.length > 0,
      url,
      capture,
      capturedAt: new Date().toISOString(),
      chromascopeVersion: version,
    });
    const images = {
      ...Object.fromEntries(updated.kept.map((browser) => [browser, fs.readFileSync(imagePath(browser))])),
      ...byBrowser(captures, ({ image }) => image),
    };
    store.write(name, updated.metadata, images);
  }
  const cleaned = shouldClean({ ...options, aboveFailAbove }) && store.remove(name) !== null;

  const result: CompareResult = {
    schemaVersion: SCHEMA_VERSION,
    command: "compare",
    runId: run.runId,
    name,
    baselineDir: dir,
    url,
    options: { ...capture, browsers, threshold: options.threshold, failAbove: options.failAbove, timeout },
    artifactsDir: run.dir,
    comparisons,
    updated: options.update,
    cleaned,
    timings: timingsOf(started, captures),
  };
  return { result, aboveFailAbove };
};
