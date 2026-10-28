import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { ChromascopeContext } from "../context";
import { capturePage } from "../lib/capture";
import type { BrowserName } from "../lib/capture-options";
import { compareImages } from "../lib/image";
import output from "../lib/output";
import { createRunFolder } from "../lib/run-folder";

export type BrowserComparison = {
  browser: BrowserName;
  pixelChange: number;
  pixelChangePercentage: number;
  /** Size of the compared canvas: the largest width and height of the two screenshots. */
  width: number;
  height: number;
  /** Absolute paths, or `""` when artifacts aren't saved. */
  diffPath: string;
  screenshotPath: string;
};

export const diff = async (link: string, ctx: ChromascopeContext) => {
  if (ctx.saveArtifacts) createRunFolder(ctx);

  const { base, browsers } = ctx.options;
  const [baseScreenshot, ...screenshots] = await allSettledOrThrow(
    browsers.map((browser) => screenshot(browser, link, ctx)),
  );

  const comparisons: Array<BrowserComparison> = browsers.slice(1).map((browser, index) => ({
    browser,
    ...diffScreenshots(baseScreenshot, screenshots[index], `${base}-${browser}`, ctx),
    screenshotPath: screenshotPath(browser, ctx),
  }));

  return { base, baseScreenshotPath: screenshotPath(base, ctx), comparisons };
};

/** Absolute path of the browser's screenshot, or `""` when artifacts aren't saved. File names are stable. */
const screenshotPath = (browserName: string, ctx: ChromascopeContext) =>
  ctx.saveArtifacts ? path.join(ctx.runFolder, `${browserName}.png`) : "";

/** Waits for every screenshot to settle, so no browser is left running, then throws the first failure. */
const allSettledOrThrow = async (screenshots: Array<Promise<Buffer>>) => {
  const results = await Promise.allSettled(screenshots);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<Buffer>).value);
};

const screenshot = async (browser: BrowserName, link: string, ctx: ChromascopeContext) => {
  const step = output.step(`Capturing ${browser} screenshot`, "📷");
  try {
    const path = screenshotPath(browser, ctx) || undefined;
    if (path) output.debug(`Saving ${browser} screenshot to ${path}`);
    const imageBuffer = await capturePage(browser, link, ctx.options, path);
    step.succeed(`Captured ${browser} screenshot`, "📸");
    return imageBuffer;
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

  let diffPath = "";
  if (ctx.saveArtifacts) {
    diffPath = path.join(ctx.runFolder, `diff-${outputName}.png`);
    output.debug(`Saving ${outputName} diff to ${diffPath}`);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return { pixelChange, pixelChangePercentage, width: diff.width, height: diff.height, diffPath };
};
