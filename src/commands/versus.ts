import { compareBeforeAfter } from "../lib/before-after";
import { captureAll } from "../lib/capture";
import { type CaptureOptions, pickImageOptions } from "../lib/capture-options";
import output from "../lib/output";
import { SCHEMA_VERSION, timingsOf, type VersusResult } from "../lib/result";
import { openRun, type RunFolderOptions } from "../lib/run";
import { pairCaptures } from "../lib/url-comparison";
import { exceedsFailAbove } from "../lib/utils";

export type VersusOptions = {
  beforeUrl: string;
  afterUrl: string;
  /** The capture options for both URLs. `cookie` is set for whichever URL is captured. */
  capture: CaptureOptions;
  threshold: number;
  failAbove: number | null;
  run: RunFolderOptions;
};

/**
 * Runs a URL comparison: captures both URLs in each browser and compares each browser's capture of the after URL
 * against its capture of the before URL. Never reads or writes baselines.
 * Resolves to the result and whether a comparison is above `--fail-above`.
 */
export const versus = async (options: VersusOptions) => {
  const started = performance.now();
  const { beforeUrl, afterUrl, capture, threshold, failAbove } = options;

  const run = openRun(options.run);
  output.debug(`Comparing ${afterUrl} against ${beforeUrl}, run folder: ${run.dir}`);

  output.info(`Before: ${beforeUrl}`);
  const before = await captureAll(capture.browsers, beforeUrl, capture);
  output.info(`After: ${afterUrl}`);
  const after = await captureAll(capture.browsers, afterUrl, capture);
  const pairs = pairCaptures(before, after);

  const comparisons = pairs.map((pair) => {
    const { comparison, files } = compareBeforeAfter(pair.browser, pair.before, pair.after, run.dir, threshold);
    for (const [file, data] of files) run.write(file, data);
    return comparison;
  });

  const result: VersusResult = {
    schemaVersion: SCHEMA_VERSION,
    command: "versus",
    runId: run.runId,
    beforeUrl,
    afterUrl,
    options: {
      ...pickImageOptions(capture),
      browsers: capture.browsers,
      threshold,
      failAbove,
      timeout: capture.timeout,
    },
    artifactsDir: run.dir,
    comparisons,
    timings: timingsOf(started, pairs),
  };
  return { result, aboveFailAbove: exceedsFailAbove(comparisons, failAbove) };
};
