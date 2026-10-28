import fs from "node:fs";
import pixelmatch from "pixelmatch";
import { type Browser, type BrowserType, chromium, firefox, webkit } from "playwright";
import { PNG, type PNGWithMetadata } from "pngjs";
import type { ChromascopeContext } from "../context";
import { withBrowser } from "../lib/browser";
import logger from "../lib/logger";
import { removeRunFolder } from "../lib/run-folder";
import { createSpinner } from "../lib/spinner";
import { parseCookieOptions } from "../lib/utils";

export type VisualDiffResult = Awaited<ReturnType<typeof diffScreenshots>> & {
  browserName: string;
};
export type ImageWithMetadata = Pick<PNGWithMetadata, "data" | "width" | "height">;

export const diff = async (link: string, ctx: ChromascopeContext) => {
  logger.setOptions({ verbose: ctx.options.verbose });

  const [chromiumScreenshot, webKitScreenshot, firefoxScreenshot] = await screenshotAll([
    screenshot(chromium, "Chromium", link, ctx),
    screenshot(webkit, "WebKit", link, ctx),
    screenshot(firefox, "Firefox", link, ctx),
  ]);

  const chromiumWebKitDiff = await diffScreenshots(chromiumScreenshot, webKitScreenshot, "chromium-webkit", ctx);
  const chromiumFirefoxDiff = await diffScreenshots(chromiumScreenshot, firefoxScreenshot, "chromium-firefox", ctx);

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
const screenshotAll = async (screenshots: Array<Promise<Buffer>>) => {
  const results = await Promise.allSettled(screenshots);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<Buffer>).value);
};

export const printResults = (res: VisualDiffResult) => {
  logger.log(`┌─ ${res.browserName}`);
  logger.log(
    `${res.diffPath ? "├─" : "└─"} 👉 ${res.pixelChangePercentage.toFixed(2)}% pixel change compared to Chromium (${
      res.pixelChange
    }px)`,
  );
  if (res.diffPath) logger.log(`└─ 👉 Visual diff stored at ${res.diffPath}`);
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

const diffScreenshots = async (
  screenshotOne: Buffer,
  screenshotTwo: Buffer,
  outputName: string,
  ctx: ChromascopeContext,
) => {
  let png1: ImageWithMetadata = PNG.sync.read(screenshotOne);
  let png2: ImageWithMetadata = PNG.sync.read(screenshotTwo);

  const size = {
    width: Math.max(png1.width, png2.width),
    height: Math.max(png1.height, png2.height),
  };

  if (png1.width !== png2.width || png1.height !== png2.height) {
    png1 = resize(png1, size);
    png2 = resize(png2, size);
  }

  const diff = new PNG({ width: size.width, height: size.height });
  const result = pixelmatch(png1.data, png2.data, diff.data, size.width, size.height, {
    threshold: ctx.options.threshold,
  });

  let diffPath = "";
  if (ctx.options.saveDiff) {
    diffPath = `${ctx.runFolder}/diff-${outputName}.png`;
    ctx.spinner.text = `Saving ${outputName} diff 🗄️`;
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  const pixelChangePercentage = (result / (size.width * size.height)) * 100;
  return { pixelChange: result, pixelChangePercentage, diffPath };
};

const resize = (image: ImageWithMetadata, { width, height }: { width: number; height: number }) => {
  if (image.width === width && image.height === height) return image;
  logger.debug(`Resizing image to ${width}x${height}...`);
  const buffer = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const to = (y * width + x) * 4;
      if (y < image.height && x < image.width) {
        const from = (y * image.width + x) * 4;
        buffer[to] = image.data[from];
        buffer[to + 1] = image.data[from + 1];
        buffer[to + 2] = image.data[from + 2];
        buffer[to + 3] = image.data[from + 3];
      } else {
        buffer[to] = 0;
        buffer[to + 1] = 0;
        buffer[to + 2] = 0;
        buffer[to + 3] = 0;
      }
    }
  }
  return { data: Buffer.from(buffer), width, height };
};
