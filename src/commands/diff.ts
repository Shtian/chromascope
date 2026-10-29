import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { ChromascopeContext } from "../context";
import { captureAll } from "../lib/capture";
import { type BrowserName, pickImageOptions } from "../lib/capture-options";
import { compareImages } from "../lib/image";
import output from "../lib/output";
import { byBrowser, type DiffComparison, type DiffResult, SCHEMA_VERSION, timingsOf } from "../lib/result";
import { createRunFolder } from "../lib/run-folder";
import { exceedsFailAbove } from "../lib/utils";

/**
 * Captures the page in every browser and compares each against the base browser.
 * Resolves to the result and whether a comparison is above `--fail-above`.
 */
export const diff = async (url: string, ctx: ChromascopeContext) => {
  const started = performance.now();
  if (ctx.saveArtifacts) createRunFolder(ctx);

  const { base, browsers, threshold, failAbove, timeout } = ctx.options;
  const captures = await captureAll(browsers, url, ctx.options, (browser) => screenshotPath(browser, ctx) ?? undefined);
  const [baseCapture, ...others] = captures;

  const comparisons: DiffComparison[] = others.map(({ browser, image }) => ({
    browser,
    ...diffScreenshots(baseCapture.image, image, `${base}-${browser}`, ctx),
  }));

  const result: DiffResult = {
    schemaVersion: SCHEMA_VERSION,
    command: "diff",
    runId: ctx.runId,
    url,
    base,
    options: { ...pickImageOptions(ctx.options), browsers, threshold, failAbove, timeout },
    artifactsDir: ctx.saveArtifacts ? ctx.runFolder : null,
    screenshots: byBrowser(captures, ({ browser }) => screenshotPath(browser, ctx)),
    comparisons,
    timings: timingsOf(started, captures),
  };
  return { result, aboveFailAbove: exceedsFailAbove(comparisons, failAbove) };
};

/** Absolute path of the browser's screenshot, or `null` when artifacts aren't saved. File names are stable. */
const screenshotPath = (browserName: BrowserName, ctx: ChromascopeContext) =>
  ctx.saveArtifacts ? path.join(ctx.runFolder, `${browserName}.png`) : null;

const diffScreenshots = (screenshotOne: Buffer, screenshotTwo: Buffer, outputName: string, ctx: ChromascopeContext) => {
  const { pixelChange, pixelChangePercentage, diff } = compareImages(
    PNG.sync.read(screenshotOne),
    PNG.sync.read(screenshotTwo),
    ctx.options.threshold,
  );

  let diffPath: string | null = null;
  if (ctx.saveArtifacts) {
    diffPath = path.join(ctx.runFolder, `diff-${outputName}.png`);
    output.debug(`Saving ${outputName} diff to ${diffPath}`);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return { pixelChange, pixelChangePercentage, width: diff.width, height: diff.height, diffPath };
};
