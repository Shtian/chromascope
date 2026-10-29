import { PNG } from "pngjs";
import { captureAll } from "../lib/capture";
import type { BrowserName, CaptureOptions } from "../lib/capture-options";
import { compareImages } from "../lib/image";
import { pickImageOptions } from "../lib/image-options";
import output from "../lib/output";
import { byBrowser, type DiffComparison, type DiffResult, SCHEMA_VERSION, timingsOf } from "../lib/result";
import { openRun, type Run, type RunFolderOptions } from "../lib/run";
import { exceedsFailAbove } from "../lib/utils";

export type DiffOptions = {
  /** The capture options. `browsers` lists the base browser first. */
  capture: CaptureOptions;
  /** The browser every other browser is compared against. Always the first of `capture.browsers`. */
  base: BrowserName;
  threshold: number;
  /** Exit `1` when a comparison's pixel change percentage is above this. `null` never fails. */
  failAbove: number | null;
  saveDiff: boolean;
  run: RunFolderOptions;
};

/**
 * Captures the page in every browser and compares each against the base browser.
 * Screenshots and diffs are written to the run folder with `--save-diff` or `--out`, once every capture succeeded.
 * Resolves to the result and whether a comparison is above `--fail-above`.
 */
export const diff = async (url: string, options: DiffOptions) => {
  const started = performance.now();
  const { capture, base, threshold, failAbove } = options;
  const { browsers, timeout } = capture;
  const run = openRun(options.run);
  // Without `--save-diff` or `--out` nothing is written, so the run folder is never created.
  const save = options.saveDiff || options.run.out ? run : null;
  output.debug(`Run ID: ${run.runId}`);
  if (save) output.debug(`Run folder: ${save.dir}`);

  const captures = await captureAll(browsers, url, capture);
  const [baseCapture, ...others] = captures;

  const screenshots = byBrowser(captures, ({ browser, image }) => saveImage(save, `${browser}.png`, image));
  const comparisons: DiffComparison[] = others.map(({ browser, image }) => ({
    browser,
    ...diffScreenshots(baseCapture.image, image, `${base}-${browser}`, threshold, save),
  }));

  const result: DiffResult = {
    schemaVersion: SCHEMA_VERSION,
    command: "diff",
    runId: run.runId,
    url,
    base,
    options: { ...pickImageOptions(capture), browsers, threshold, failAbove, timeout },
    artifactsDir: save ? save.dir : null,
    screenshots,
    comparisons,
    timings: timingsOf(started, captures),
  };
  return { result, aboveFailAbove: exceedsFailAbove(comparisons, failAbove) };
};

/** Writes the image to the run folder and returns its absolute path, or `null` when artifacts aren't saved. */
const saveImage = (run: Run | null, name: string, image: Buffer) => {
  if (!run) return null;
  output.debug(`Saving ${name} to ${run.pathOf(name)}`);
  return run.write(name, image);
};

const diffScreenshots = (
  screenshotOne: Buffer,
  screenshotTwo: Buffer,
  outputName: string,
  threshold: number,
  run: Run | null,
) => {
  const { pixelChange, pixelChangePercentage, diff } = compareImages(
    PNG.sync.read(screenshotOne),
    PNG.sync.read(screenshotTwo),
    threshold,
  );
  const diffPath = saveImage(run, `diff-${outputName}.png`, PNG.sync.write(diff));
  return { pixelChange, pixelChangePercentage, width: diff.width, height: diff.height, diffPath };
};
