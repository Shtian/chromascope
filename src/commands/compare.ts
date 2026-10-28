import fs from "node:fs";
import path from "node:path";
import { version } from "../../package.json";
import { createRunId } from "../context";
import { type BaselineStore, deriveBaselineName } from "../lib/baselines";
import { compareWithBaseline, planComparison, shouldClean, updatedBaseline } from "../lib/before-after";
import { captureAll } from "../lib/capture";
import type { BrowserName, ImageOptions } from "../lib/capture-options";
import output from "../lib/output";
import { type CompareResult, SCHEMA_VERSION } from "../lib/result";
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
  const name = options.name ?? deriveBaselineName(options.url ?? "", options.given.element ?? null);
  const { baseline, url, capture, browsers, conflicts } = planComparison({
    name,
    root: store.root,
    baseline: store.read(name),
    url: options.url,
    nameGiven: options.name !== null,
    given: options.given,
    browsers: options.browsers,
    update: options.update,
    baselineDir: options.baselineDir,
  });
  const { dir, metadata, imagePath } = baseline;

  const runId = createRunId();
  const runFolder = path.resolve(options.out ?? path.join(options.folder, runId));
  createRunFolder({ runFolder, options });
  output.debug(`Comparing ${url} against baseline ${dir}, run folder: ${runFolder}`);

  const captures = await captureAll(browsers, url, {
    ...capture,
    browsers,
    timeout: options.timeout,
    cookie: options.cookie,
  });

  const comparisons = captures.map(({ browser, image }) => {
    const { comparison, files } = compareWithBaseline(
      browser,
      fs.readFileSync(imagePath(browser)),
      image,
      runFolder,
      options.threshold,
    );
    for (const [file, data] of files) fs.writeFileSync(file, data);
    return comparison;
  });
  const aboveFailAbove = isAboveFailAbove(
    comparisons.map((comparison) => comparison.pixelChangePercentage),
    options.failAbove,
  );

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
    const images = Object.fromEntries([
      ...updated.kept.map((browser) => [browser, fs.readFileSync(imagePath(browser))] as const),
      ...captures.map(({ browser, image }) => [browser, image] as const),
    ]);
    store.write(name, updated.metadata, images);
  }
  const cleaned = shouldClean({ ...options, aboveFailAbove }) && store.remove(name) !== null;

  const result: CompareResult = {
    schemaVersion: SCHEMA_VERSION,
    command: "compare",
    runId,
    name,
    baselineDir: dir,
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
