import fs from "fs";
import { webkit, firefox, chromium, Browser } from "@playwright/test";
import { PNG } from "pngjs";
import { ChromascopeContext } from "./context";
import pixelmatch from "pixelmatch";
import logger from "./logger";
import { createSpinner } from "./spinner";

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
      : "";
  const webkitScreenshotPath =
    webkitScreenshotResult.status === "fulfilled"
      ? webkitScreenshotResult.value
      : "";
  const firefoxScreenshotPath =
    firefoxScreenshotResult.status === "fulfilled"
      ? firefoxScreenshotResult.value
      : "";

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

  // TODO: Return diff as percentage
  return { webkit: chromiumWebkitDiff, firefox: chromiumFirefoxDiff };
};

const screenshotWebkit = async (link: string, ctx: ChromascopeContext) => {
  const webkitSpinner = createSpinner().start("Capturing WebKit screenshot 📷");
  const browser = await webkit.launch();
  const screenshotPath = await captureBrowserScreenshot(link, browser, ctx);
  webkitSpinner.succeed("Captured WebKit screenshot 📸");
  return screenshotPath;
};

const screenshotFirefox = async (link: string, ctx: ChromascopeContext) => {
  const firefoxSpinner = createSpinner().start(
    "Capturing Firefox screenshot 📷"
  );
  const browser = await firefox.launch();
  const screenshotPath = await captureBrowserScreenshot(link, browser, ctx);
  firefoxSpinner.succeed("Captured Firefox screenshot 📸");
  return screenshotPath;
};

const screenshotChromium = async (link: string, ctx: ChromascopeContext) => {
  const chromiumSpinner = createSpinner().start(
    "Capturing Chromium screenshot 📷"
  );
  const browser = await chromium.launch();
  const screenshotPath = await captureBrowserScreenshot(link, browser, ctx);
  chromiumSpinner.succeed("Captured Chromium screenshot 📸");
  return screenshotPath;
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
  const path = `${ctx.options.runFolder}/${name}.png`;
  logger.debug(`Saving ${name} screenshot to ${path}`);
  await page.screenshot({ path });
  return path;
};

const diffScreenshots = (
  screenshotOnePath: string,
  screenshotTwoPath: string,
  outputName: string,
  ctx: ChromascopeContext
) => {
  const png1 = PNG.sync.read(fs.readFileSync(screenshotOnePath));
  const png2 = PNG.sync.read(fs.readFileSync(screenshotTwoPath));

  const { width, height } = png1;
  const diff = new PNG({ width, height });
  const result = pixelmatch(png1.data, png2.data, diff.data, width, height, {
    threshold: ctx.options.threshold,
  });

  if (ctx.options.saveDiff) {
    ctx.spinner.text = `Saving ${outputName} diff 🗄️`;
    fs.writeFileSync(
      `${ctx.options.runFolder}/diff-${outputName}.png`,
      PNG.sync.write(diff)
    );
  }
  return result;
};
