import fs from "fs";
import { webkit, firefox, chromium, Browser } from "@playwright/test";
import { PNG } from "pngjs";
import { ChromascopeContext } from "./context";
import pixelmatch from "pixelmatch";
import logger from "./logger";

export const diff = async (link: string, ctx: ChromascopeContext) => {
  logger.setOptions({ verbose: ctx.options.verbose });

  const chromiumScreenshotPath = await diffChromium(link, ctx);
  const webkitScreenshotPath = await diffWebkit(link, ctx);
  const firefoxScreenshotPath = await diffFirefox(link, ctx);

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
    fs.rmdirSync(ctx.options.folder, { recursive: true });
  }

  ctx.spinner.clear();
  return { webkit: chromiumWebkitDiff, firefox: chromiumFirefoxDiff };
};

const diffWebkit = async (link: string, ctx: ChromascopeContext) => {
  ctx.spinner.text = "Diffing Webkit...";
  const browser = await webkit.launch();
  return await runBrowserDiff(link, browser, ctx);
};

const diffFirefox = async (link: string, ctx: ChromascopeContext) => {
  ctx.spinner.text = "Diffing Firefox...";
  const browser = await firefox.launch();
  return await runBrowserDiff(link, browser, ctx);
};

const diffChromium = async (link: string, ctx: ChromascopeContext) => {
  ctx.spinner.text = "Diffing Chromium...";
  const browser = await chromium.launch();
  return await runBrowserDiff(link, browser, ctx);
};

const runBrowserDiff = async (
  link: string,
  browser: Browser,
  ctx: ChromascopeContext
) => {
  const context = await browser.newContext();
  const type = browser.browserType();
  const name = type.name();
  const page = await context.newPage();
  await page.goto(link);
  const path = `${ctx.options.folder}/${name}.png`;
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
    ctx.spinner.text = `Saving ${outputName} diff...`;
    fs.writeFileSync(
      `${ctx.options.folder}/diff-${outputName}.png`,
      PNG.sync.write(diff)
    );
  }
  return result;
};
