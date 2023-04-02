import { ChromascopeContext } from "../context";
import logger from "../lib/logger";
import { createSpinner } from "../lib/spinner";
import { parseCookieOptions } from "../lib/utils";
import { Browser, chromium, firefox, webkit } from "@playwright/test";
import fs from "fs";
import pixelmatch from "pixelmatch";
import { PNG, PNGWithMetadata } from "pngjs";

export type VisualDiffResult = Awaited<ReturnType<typeof diffScreenshots>> & {
  browserName: string;
};
export type ImageWithMetadata = Pick<PNGWithMetadata, "data" | "width" | "height">;

export const diff = async (link: string, ctx: ChromascopeContext) => {
  logger.setOptions({ verbose: ctx.options.verbose });

  const screenshots = [screenshotChromium(link, ctx), screenshotWebKit(link, ctx), screenshotFirefox(link, ctx)];
  const results = await Promise.allSettled(screenshots);
  const [chromiumScreenshotResult, webKitScreenshotResult, firefoxScreenshotResult] = results;

  const chromiumScreenshotPath =
    chromiumScreenshotResult.status === "fulfilled" ? chromiumScreenshotResult.value : null;
  const webKitScreenshotPath = webKitScreenshotResult.status === "fulfilled" ? webKitScreenshotResult.value : null;
  const firefoxScreenshotPath = firefoxScreenshotResult.status === "fulfilled" ? firefoxScreenshotResult.value : null;

  const chromiumWebKitDiff = await diffScreenshots(
    chromiumScreenshotPath,
    webKitScreenshotPath,
    "chromium-webkit",
    ctx,
  );
  const chromiumFirefoxDiff = await diffScreenshots(
    chromiumScreenshotPath,
    firefoxScreenshotPath,
    "chromium-firefox",
    ctx,
  );

  if (!ctx.options.saveDiff) {
    ctx.spinner.text = "Cleaning up 🧹";
    fs.rmdirSync(ctx.runFolder, { recursive: true });

    const files = fs.readdirSync(ctx.options.folder);
    if (files.length === 0) {
      fs.rmdirSync(ctx.options.folder);
    }
  }

  ctx.spinner.text = "";

  const result: Array<VisualDiffResult> = [
    { ...chromiumWebKitDiff, browserName: "🍎 WebKit" },
    { ...chromiumFirefoxDiff, browserName: "🦊 Firefox" },
  ];

  return result;
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

const screenshotWebKit = async (link: string, ctx: ChromascopeContext) => {
  const webKitSpinner = createSpinner().start("Capturing WebKit screenshot 📷");
  const browser = await webkit.launch();
  const imageBuffer = await captureBrowserScreenshot(link, browser, ctx);
  webKitSpinner.succeed("Captured WebKit screenshot 📸");
  return imageBuffer;
};

const screenshotFirefox = async (link: string, ctx: ChromascopeContext) => {
  const firefoxSpinner = createSpinner().start("Capturing Firefox screenshot 📷");
  const browser = await firefox.launch();
  const imageBuffer = await captureBrowserScreenshot(link, browser, ctx);
  firefoxSpinner.succeed("Captured Firefox screenshot 📸");
  return imageBuffer;
};

const screenshotChromium = async (link: string, ctx: ChromascopeContext) => {
  const chromiumSpinner = createSpinner().start("Capturing Chromium screenshot 📷");
  const browser = await chromium.launch();
  const imageBuffer = await captureBrowserScreenshot(link, browser, ctx);
  chromiumSpinner.succeed("Captured Chromium screenshot 📸");
  return imageBuffer;
};

const captureBrowserScreenshot = async (link: string, browser: Browser, ctx: ChromascopeContext) => {
  const context = await browser.newContext();
  const type = browser.browserType();
  const name = type.name();
  const page = await context.newPage();
  const cookiesToAdd = parseCookieOptions(ctx.options.cookie, link);
  if (cookiesToAdd.length > 0) {
    logger.debug(`Adding cookies to ${name} context: ${JSON.stringify(cookiesToAdd)}`);
    context.addCookies(parseCookieOptions(ctx.options.cookie, link));
  }
  await page.goto(link);
  const path = ctx.options.saveDiff ? `${ctx.runFolder}/${name}.png` : undefined;
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
  ctx: ChromascopeContext,
) => {
  if (!screenshotOne || !screenshotTwo) {
    throw new Error("Screenshot buffer cannot be null");
  }
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
