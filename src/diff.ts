import fs from "fs";
import { webkit, firefox, chromium, Browser } from "@playwright/test";
import { PNG } from "pngjs";
import { ChromascopeContext } from "./context";
import pixelmatch from "pixelmatch";
import logger from "./logger";
import { createSpinner } from "./spinner";

export type DiffResult = ReturnType<typeof diffScreenshots> & {
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

  const chromiumWebkitDiff = diffScreenshots(
    chromiumScreenshotPath,
    webkitScreenshotPath,
    "chromium-webkit",
    ctx
  );
  const chromiumFirefoxDiff = diffScreenshots(
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
  const imageBuffer = await page.screenshot({ path, fullPage: true });
  return imageBuffer;
};

const diffScreenshots = (
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

  const { width, height } = png1;
  const diff = new PNG({ width, height });
  const result = pixelmatch(png1.data, png2.data, diff.data, width, height, {
    threshold: ctx.options.threshold,
  });

  let diffPath = "";
  if (ctx.options.saveDiff) {
    diffPath = `${ctx.options.runFolder}/diff-${outputName}.png`;
    ctx.spinner.text = `Saving ${outputName} diff 🗄️`;
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  const pixelChangePercentage = (result / (width * height)) * 100;
  return { pixelChange: result, pixelChangePercentage, diffPath };
};
