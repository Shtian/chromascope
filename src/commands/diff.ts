import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { ChromascopeContext } from "../context";
import { capturePage } from "../lib/capture";
import type { BrowserName } from "../lib/capture-options";
import { compareImages } from "../lib/image";
import output from "../lib/output";
import { type DiffComparison, type DiffResult, SCHEMA_VERSION } from "../lib/result";
import { createRunFolder } from "../lib/run-folder";

export const diff = async (url: string, ctx: ChromascopeContext): Promise<DiffResult> => {
  const started = performance.now();
  if (ctx.saveArtifacts) createRunFolder(ctx);

  const { base, browsers, element, fullPage, viewport, deviceScaleFactor, waitFor, waitUntil } = ctx.options;
  const { threshold, failAbove, timeout } = ctx.options;
  const [baseCapture, ...captures] = await allSettledOrThrow(browsers.map((browser) => capture(browser, url, ctx)));

  const comparisons: DiffComparison[] = browsers.slice(1).map((browser, index) => ({
    browser,
    ...diffScreenshots(baseCapture.image, captures[index].image, `${base}-${browser}`, ctx),
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    command: "diff",
    runId: ctx.runId,
    url,
    base,
    options: {
      browsers,
      element,
      fullPage,
      viewport,
      deviceScaleFactor,
      waitFor,
      waitUntil,
      threshold,
      failAbove,
      timeout,
    },
    artifactsDir: ctx.saveArtifacts ? ctx.runFolder : null,
    screenshots: Object.fromEntries(browsers.map((browser) => [browser, screenshotPath(browser, ctx)])),
    comparisons,
    timings: {
      totalMs: Math.round(performance.now() - started),
      captureMs: Object.fromEntries([baseCapture, ...captures].map((c) => [c.browser, c.ms])),
    },
  };
};

/** Absolute path of the browser's screenshot, or `null` when artifacts aren't saved. File names are stable. */
const screenshotPath = (browserName: string, ctx: ChromascopeContext) =>
  ctx.saveArtifacts ? path.join(ctx.runFolder, `${browserName}.png`) : null;

/** Waits for every capture to settle, so no browser is left running, then throws the first failure. */
const allSettledOrThrow = async <T>(captures: Array<Promise<T>>) => {
  const results = await Promise.allSettled(captures);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
};

const capture = async (browser: BrowserName, url: string, ctx: ChromascopeContext) => {
  const step = output.step(`Capturing ${browser} screenshot`, "📷");
  const started = performance.now();
  try {
    const path = screenshotPath(browser, ctx) ?? undefined;
    if (path) output.debug(`Saving ${browser} screenshot to ${path}`);
    const image = await capturePage(browser, url, ctx.options, path);
    step.succeed(`Captured ${browser} screenshot`, "📸");
    return { browser, image, ms: Math.round(performance.now() - started) };
  } catch (error) {
    step.fail(`Failed to capture ${browser} screenshot`);
    throw error;
  }
};

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
