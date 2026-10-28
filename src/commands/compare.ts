import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { version } from "../../package.json";
import { createRunId } from "../context";
import {
  type BaselineStore,
  baselineNotFound,
  captureConflictError,
  deriveBaselineName,
  findCaptureConflicts,
} from "../lib/baselines";
import { captureAll } from "../lib/capture";
import type { BrowserName, ImageOptions } from "../lib/capture-options";
import { compareImages } from "../lib/image";
import output from "../lib/output";
import { type CompareComparison, type CompareResult, SCHEMA_VERSION } from "../lib/result";
import { createRunFolder } from "../lib/run-folder";
import { isAboveFailAbove } from "../lib/utils";

export type CompareOptions = {
  /** The URL to capture. Defaults to the baseline's URL. */
  url: string | null;
  /** The baseline name. Derived from the URL and element when not given. */
  name: string | null;
  /** The image options that were given. Each must match the baseline's, unless `update` is set. */
  given: Partial<ImageOptions>;
  /** The browsers to compare. Defaults to every browser of the baseline. */
  browsers: BrowserName[] | null;
  timeout: number;
  cookie: string;
  threshold: number;
  failAbove: number | null;
  update: boolean;
  clean: boolean;
  folder: string;
  out?: string;
  /** `--baseline-dir` as given, for the hint when the baseline is missing. */
  baselineDir?: string;
};

/**
 * Captures the page again and compares each browser against its own baseline.
 * Resolves to the result and whether a comparison is above `--fail-above`.
 */
export const compare = async (options: CompareOptions, store: BaselineStore) => {
  const started = performance.now();
  const element = options.given.element ?? null;
  const name = options.name ?? deriveBaselineName(options.url ?? "", element);
  const hint = { name: options.name ?? undefined, baselineDir: options.baselineDir };

  const baseline = store.read(name);
  if (!baseline) {
    throw baselineNotFound(`no baseline named ${JSON.stringify(name)} in ${store.root}`, {
      ...hint,
      url: options.url,
      element,
    });
  }

  const conflicts = findCaptureConflicts(baseline.metadata.capture, options.given);
  if (conflicts.length > 0 && !options.update) throw captureConflictError(conflicts);

  const browsers = options.browsers ?? baseline.metadata.browsers;
  const absent = browsers.filter((browser) => !baseline.has(browser));
  if (absent.length > 0) {
    throw baselineNotFound(`baseline ${JSON.stringify(name)} has no ${absent.join(", ")} capture`, {
      ...hint,
      url: options.url ?? baseline.metadata.url,
      element: baseline.metadata.capture.element,
      browsers: [...new Set([...baseline.metadata.browsers, ...browsers])],
    });
  }

  const url = options.url ?? baseline.metadata.url;
  const capture = { ...baseline.metadata.capture, ...options.given };
  const runId = createRunId();
  const runFolder = path.resolve(options.out ?? path.join(options.folder, runId));
  createRunFolder({ runFolder, options });
  output.debug(`Comparing ${url} against baseline ${baseline.dir}, run folder: ${runFolder}`);

  const captures = await captureAll(browsers, url, {
    ...capture,
    browsers,
    timeout: options.timeout,
    cookie: options.cookie,
  });

  const comparisons = captures.map(({ browser, image }) =>
    compareWithBaseline(browser, fs.readFileSync(baseline.imagePath(browser)), image, runFolder, options.threshold),
  );
  const aboveFailAbove = isAboveFailAbove(
    comparisons.map((comparison) => comparison.pixelChangePercentage),
    options.failAbove,
  );

  if (options.update) {
    const updated = Object.fromEntries(captures.map(({ browser, image }) => [browser, image]));
    // Browsers that weren't compared keep their baseline, unless the capture options changed under them.
    const kept = conflicts.length > 0 ? [] : baseline.metadata.browsers.filter((browser) => !(browser in updated));
    for (const browser of kept) updated[browser] = fs.readFileSync(baseline.imagePath(browser));
    store.write(
      name,
      {
        url,
        browsers: [...kept, ...browsers],
        capture,
        capturedAt: new Date().toISOString(),
        chromascopeVersion: version,
      },
      updated,
    );
  }
  const cleaned = options.clean && !aboveFailAbove && store.remove(name) !== null;

  const result: CompareResult = {
    schemaVersion: SCHEMA_VERSION,
    command: "compare",
    runId,
    name,
    baselineDir: baseline.dir,
    url,
    options: {
      ...capture,
      browsers,
      threshold: options.threshold,
      failAbove: options.failAbove,
      timeout: options.timeout,
    },
    artifactsDir: runFolder,
    comparisons,
    updated: options.update,
    cleaned,
    timings: {
      totalMs: Math.round(performance.now() - started),
      captureMs: Object.fromEntries(captures.map(({ browser, ms }) => [browser, ms])),
    },
  };
  return { result, aboveFailAbove };
};

/** Writes the before, after and diff images to the run folder, and measures the change. */
const compareWithBaseline = (
  browser: BrowserName,
  before: Buffer,
  after: Buffer,
  runFolder: string,
  threshold: number,
): CompareComparison => {
  const beforeImage = PNG.sync.read(before);
  const afterImage = PNG.sync.read(after);
  const { pixelChange, pixelChangePercentage, diff } = compareImages(beforeImage, afterImage, threshold);

  const beforePath = path.join(runFolder, `before-${browser}.png`);
  const afterPath = path.join(runFolder, `after-${browser}.png`);
  const diffPath = path.join(runFolder, `diff-${browser}.png`);
  fs.writeFileSync(beforePath, before);
  fs.writeFileSync(afterPath, after);
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    browser,
    pixelChange,
    pixelChangePercentage,
    before: { width: beforeImage.width, height: beforeImage.height },
    after: { width: afterImage.width, height: afterImage.height },
    sizeChanged: beforeImage.width !== afterImage.width || beforeImage.height !== afterImage.height,
    beforePath,
    afterPath,
    diffPath,
  };
};
