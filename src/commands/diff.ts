import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { ChromascopeContext } from "../context";
import { captureAll } from "../lib/capture";
import { pickImageOptions } from "../lib/capture-options";
import { compareImages } from "../lib/image";
import output from "../lib/output";
import { type DiffComparison, type DiffResult, SCHEMA_VERSION } from "../lib/result";
import { createRunFolder } from "../lib/run-folder";

export const diff = async (url: string, ctx: ChromascopeContext): Promise<DiffResult> => {
  const started = performance.now();
  if (ctx.saveArtifacts) createRunFolder(ctx);

  const { base, browsers, threshold, failAbove, timeout } = ctx.options;
  const [baseCapture, ...captures] = await captureAll(
    browsers,
    url,
    ctx.options,
    (browser) => screenshotPath(browser, ctx) ?? undefined,
  );

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
    options: { ...pickImageOptions(ctx.options), browsers, threshold, failAbove, timeout },
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
