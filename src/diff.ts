import fs from "fs";
import { webkit, firefox, chromium, Browser } from "@playwright/test";
import { PNG, PNGWithMetadata } from "pngjs";
import { ChromascopeContext } from "./context";
import pixelmatch from "pixelmatch";
import logger from "./logger";
import { createSpinner } from "./spinner";
import sharp from "sharp";

export type DiffResult = Awaited<ReturnType<typeof diffScreenshots>> & {
  browserName: string;
};

export const diff = async (link: string, ctx: ChromascopeContext) => {
  logger.setOptions({ verbose: ctx.options.verbose });

  const screenshots = [
    screenshotChromium(link, ctx),
    screenshotWebkit(link, ctx),
    screenshotFirefox(link, ctx),
  ];

  const results = await Promise.allSettled(screenshots);

  const [
    chromiumScreenshotResult,
    webkitScreenshotResult,
    firefoxScreenshotResult,
  ] = results;
  const chromiumScreenshotPath =
    chromiumScreenshotResult.status === "fulfilled"
      ? chromiumScreenshotResult.value
      : null;
  const webkitScreenshotPath =
    webkitScreenshotResult.status === "fulfilled"
      ? webkitScreenshotResult.value
      : null;
  const firefoxScreenshotPath =
    firefoxScreenshotResult.status === "fulfilled"
      ? firefoxScreenshotResult.value
      : null;

  const chromiumWebkitDiff = await diffScreenshots(
    chromiumScreenshotPath,
    webkitScreenshotPath,
    "chromium-webkit",
    ctx
  );
  const chromiumFirefoxDiff = await diffScreenshots(
    chromiumScreenshotPath,
    firefoxScreenshotPath,
    "chromium-firefox",
    ctx
  );

  if (!ctx.options.saveDiff) {
    ctx.spinner.text = "Cleaning up 🧹";
    fs.rmdirSync(ctx.options.runFolder, { recursive: true });

    const files = fs.readdirSync(ctx.options.folder);
    if (files.length === 0) {
      fs.rmdirSync(ctx.options.folder);
    }
  }

  ctx.spinner.text = "";

  return [
    { ...chromiumWebkitDiff, browserName: "🍎 WebKit" },
    { ...chromiumFirefoxDiff, browserName: "🦊 Firefox" },
  ];
};

const screenshotWebkit = async (link: string, ctx: ChromascopeContext) => {
  const webkitSpinner = createSpinner().start("Capturing WebKit screenshot 📷");
  const browser = await webkit.launch();
  const imageBuffer = await captureBrowserScreenshot(link, browser, ctx);
  webkitSpinner.succeed("Captured WebKit screenshot 📸");
  return imageBuffer;
};

const screenshotFirefox = async (link: string, ctx: ChromascopeContext) => {
  const firefoxSpinner = createSpinner().start(
    "Capturing Firefox screenshot 📷"
  );
  const browser = await firefox.launch();
  const imageBuffer = await captureBrowserScreenshot(link, browser, ctx);
  firefoxSpinner.succeed("Captured Firefox screenshot 📸");
  return imageBuffer;
};

const screenshotChromium = async (link: string, ctx: ChromascopeContext) => {
  const chromiumSpinner = createSpinner().start(
    "Capturing Chromium screenshot 📷"
  );
  const browser = await chromium.launch();
  const imageBuffer = await captureBrowserScreenshot(link, browser, ctx);
  chromiumSpinner.succeed("Captured Chromium screenshot 📸");
  return imageBuffer;
};

const captureBrowserScreenshot = async (
  link: string,
  browser: Browser,
  ctx: ChromascopeContext
) => {
  const context = await browser.newContext();
  const type = browser.browserType();
  const name = type.name();
  const page = await context.newPage();
  await page.goto(link);
  const path = ctx.options.saveDiff
    ? `${ctx.options.runFolder}/${name}.png`
    : undefined;
  logger.debug(`Saving ${name} screenshot to ${path}`);

  const imageBuffer = ctx.options.element
    ? await page.locator(ctx.options.element).screenshot({ path })
    : await page.screenshot({ path, fullPage: ctx.options.fullPage });
  return imageBuffer;
};

const diffScreenshots = async (
  screenshotOne: Buffer | null,
  screenshotTwo: Buffer | null,
  outputName: string,
  ctx: ChromascopeContext
) => {
  if (!screenshotOne || !screenshotTwo) {
    throw new Error("One of the screenshot buffers is null.");
  }
  const png1 = PNG.sync.read(screenshotOne);
  const png2 = PNG.sync.read(screenshotTwo);

  const { width: width1, height: height1 } = png1;
  const { width: width2, height: height2 } = png2;

  const maxWidth = Math.max(width1, width2);
  const maxHeight = Math.max(height1, height2);

  const buffer1 = await resize(png1, maxWidth, maxHeight);
  const buffer2 = await resize(png2, maxWidth, maxHeight);

  const diff = new PNG({ width: maxWidth, height: maxHeight });
  const result = pixelmatch(buffer1, buffer2, diff.data, width1, height1, {
    threshold: ctx.options.threshold,
  });

  let diffPath = "";
  if (ctx.options.saveDiff) {
    diffPath = `${ctx.options.runFolder}/diff-${outputName}.png`;
    ctx.spinner.text = `Saving ${outputName} diff 🗄️`;
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  const pixelChangePercentage = (result / (width1 * height1)) * 100;
  return { pixelChange: result, pixelChangePercentage, diffPath };
};

const resize = async (
  img: PNGWithMetadata,
  toWidth: number,
  toHeight: number
) => {
  const { width, height } = img;
  if (width === toWidth && height === toHeight) return img.data;
  return await sharp(img.data)
    .resize({
      width: toWidth,
      height: toHeight,
      fit: "contain",
      position: "left top",
    })
    .toBuffer();
};
