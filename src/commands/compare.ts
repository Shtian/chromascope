import fs from "node:fs";
import { version } from "../../package.json";
import { type BaselineStore, deriveBaselineName } from "../lib/baselines";
import { planComparison, shouldClean, updatedBaseline } from "../lib/before-after";
import type { BrowserName } from "../lib/capture-options";
import type { Capturer } from "../lib/capturer";
import { runComparison } from "../lib/comparison-run";
import type { ImageOptions } from "../lib/image-options";
import output from "../lib/output";
import { byBrowser, type CompareResult } from "../lib/result";
import type { RunFolderOptions } from "../lib/run";

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
export const compare = async (options: CompareOptions, store: BaselineStore, capturer: Capturer) => {
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
  output.debug(`Comparing ${url} against baseline ${dir}`);

  const { result, captures, aboveFailAbove } = await runComparison(
    {
      ...options,
      command: "compare",
      fields: { name, baselineDir: dir, url },
      url,
      before: { kind: "baseline", image: (browser) => fs.readFileSync(imagePath(browser)) },
      capture: { ...capture, browsers, timeout, cookie },
    },
    capturer,
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
    const images = {
      ...Object.fromEntries(updated.kept.map((browser) => [browser, fs.readFileSync(imagePath(browser))])),
      ...byBrowser(captures, ({ image }) => image),
    };
    store.write(name, updated.metadata, images);
  }
  const cleaned = shouldClean({ ...options, aboveFailAbove }) && store.remove(name) !== null;

  return { result: { ...result, updated: options.update, cleaned } satisfies CompareResult, aboveFailAbove };
};
