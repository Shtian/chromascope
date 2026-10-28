import fs from "node:fs";
import { type Browser, type BrowserType, chromium, firefox, webkit } from "playwright";
import { PNG } from "pngjs";
import type { ChromascopeContext } from "../context";
import { withBrowser } from "../lib/browser";
import { compareImages, formatResult } from "../lib/image";
import logger from "../lib/logger";
import { removeRunFolder } from "../lib/run-folder";
import { createSpinner } from "../lib/spinner";
import { parseCookieOptions } from "../lib/utils";

export type VisualDiffResult = ReturnType<typeof diffScreenshots> & {
  browserName: string;
};

export const diff = async (link: string, ctx: ChromascopeContext) => {
  logger.setOptions({ verbose: ctx.options.verbose });

  const [chromiumScreenshot, webKitScreenshot, firefoxScreenshot] = await allSettledOrThrow([
    screenshot(chromium, "Chromium", link, ctx),
    screenshot(webkit, "WebKit", link, ctx),
    screenshot(firefox, "Firefox", link, ctx),
  ]);

  const chromiumWebKitDiff = diffScreenshots(chromiumScreenshot, webKitScreenshot, "chromium-webkit", ctx);
  const chromiumFirefoxDiff = diffScreenshots(chromiumScreenshot, firefoxScreenshot, "chromium-firefox", ctx);

  if (!ctx.options.saveDiff) {
    ctx.spinner.text = "Cleaning up 🧹";
    removeRunFolder(ctx.runFolder, ctx.options.folder);
  }

  ctx.spinner.text = "";

  const result: Array<VisualDiffResult> = [
    { ...chromiumWebKitDiff, browserName: "🍎 WebKit" },
    { ...chromiumFirefoxDiff, browserName: "🦊 Firefox" },
  ];

  return result;
};

/** Waits for every screenshot to settle, so no browser is left running, then throws the first failure. */
const allSettledOrThrow = async (screenshots: Array<Promise<Buffer>>) => {
  const results = await Promise.allSettled(screenshots);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<Buffer>).value);
};

export const printResults = (res: VisualDiffResult) => {
  for (const line of formatResult(res)) logger.log(line);
};

const screenshot = async (browserType: BrowserType, displayName: string, link: string, ctx: ChromascopeContext) => {
  const browserSpinner = createSpinner().start(`Capturing ${displayName} screenshot 📷`);
  try {
    const imageBuffer = await withBrowser(browserType, (browser) => captureBrowserScreenshot(link, browser, ctx));
    browserSpinner.succeed(`Captured ${displayName} screenshot 📸`);
    return imageBuffer;
  } catch (error) {
    browserSpinner.fail(`Failed to capture ${displayName} screenshot`);
    throw error;
  }
};

const captureBrowserScreenshot = async (link: string, browser: Browser, ctx: ChromascopeContext) => {
  const context = await browser.newContext();
  if (ctx.options.cookie) {
    await context.addCookies(parseCookieOptions(ctx.options.cookie, link));
  }
  const type = browser.browserType();
  const name = type.name();
  const page = await context.newPage();
  await page.goto(link);
  const path = ctx.options.saveDiff ? `${ctx.runFolder}/${name}.png` : undefined;
  logger.debug(`Saving ${name} screenshot to ${path}`);

  const imageBuffer = ctx.options.element
    ? await page.locator(ctx.options.element).screenshot({ path })
    : await page.screenshot({ path, fullPage: ctx.options.fullPage });
  return imageBuffer;
};

const diffScreenshots = (screenshotOne: Buffer, screenshotTwo: Buffer, outputName: string, ctx: ChromascopeContext) => {
  const { pixelChange, pixelChangePercentage, diff } = compareImages(
    PNG.sync.read(screenshotOne),
    PNG.sync.read(screenshotTwo),
    ctx.options.threshold,
  );

  let diffPath = "";
  if (ctx.options.saveDiff) {
    diffPath = `${ctx.runFolder}/diff-${outputName}.png`;
    ctx.spinner.text = `Saving ${outputName} diff 🗄️`;
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return { pixelChange, pixelChangePercentage, diffPath };
};
