import fs from "node:fs";
import { type RunFolderOptions, resolveRun } from "../context";
import { compareBeforeAfter } from "../lib/before-after";
import { captureAll } from "../lib/capture";
import { type CaptureOptions, pickImageOptions } from "../lib/capture-options";
import output from "../lib/output";
import { SCHEMA_VERSION, timingsOf, type VersusResult } from "../lib/result";
import { createRunFolder } from "../lib/run-folder";
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

  const { runId, runFolder } = resolveRun(options.run);
  createRunFolder({ runFolder, options: options.run });
  output.debug(`Comparing ${afterUrl} against ${beforeUrl}, run folder: ${runFolder}`);

  output.info(`Before: ${beforeUrl}`);
  const before = await captureAll(capture.browsers, beforeUrl, capture);
  output.info(`After: ${afterUrl}`);
  const after = await captureAll(capture.browsers, afterUrl, capture);
  const pairs = pairCaptures(before, after);

  const comparisons = pairs.map((pair) => {
    const { comparison, files } = compareBeforeAfter(pair.browser, pair.before, pair.after, runFolder, threshold);
    for (const [file, data] of files) fs.writeFileSync(file, data);
    return comparison;
  });

  const result: VersusResult = {
    schemaVersion: SCHEMA_VERSION,
    command: "versus",
    runId,
    beforeUrl,
    afterUrl,
    options: {
      ...pickImageOptions(capture),
      browsers: capture.browsers,
      threshold,
      failAbove,
      timeout: capture.timeout,
    },
    artifactsDir: runFolder,
    comparisons,
    timings: timingsOf(started, pairs),
  };
  return { result, aboveFailAbove: exceedsFailAbove(comparisons, failAbove) };
};
