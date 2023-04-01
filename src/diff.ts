import { webkit, firefox, chromium, Browser } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "fs";
import { ChromascopeContext } from "./chromascope-context";

interface DiffOptions {
  verbose: boolean;
  runId: string;
}

export const diff = async (link: string, ctx: ChromascopeContext) => {
  await diffWebkit(link, ctx);
  await diffFirefox(link, ctx);
  await diffChromium(link, ctx);
  await diffChromiumToWebkit(ctx);
  return true;
};

const diffWebkit = async (link: string, ctx: ChromascopeContext) => {
  const browser = await webkit.launch();
  await runBrowserDiff(link, browser, ctx);
};

const diffFirefox = async (link: string, ctx: ChromascopeContext) => {
  const browser = await firefox.launch();
  await runBrowserDiff(link, browser, ctx);
};

const diffChromium = async (link: string, ctx: ChromascopeContext) => {
  const browser = await chromium.launch();
  await runBrowserDiff(link, browser, ctx);
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
  const path = `runs/${ctx.runId}/${name}.png`;
  if (ctx.options.verbose) {
    console.log(`Saving ${name} screenshot to ${path}`);
  }
  await page.screenshot({ path });
};

const diffChromiumToWebkit = (ctx: ChromascopeContext) => {
  const baseFolder = `chromascope-runs`;
  const chromiumPath = `${baseFolder}/${ctx.runId}/chromium.png`;
  const webkitPath = `${baseFolder}/${ctx.runId}/webkit.png`;
  const diffPath = `${baseFolder}/${ctx.runId}/diff.png`;

  const chromiumPng = PNG.sync.read(fs.readFileSync(chromiumPath));
  const webkitPng = PNG.sync.read(fs.readFileSync(webkitPath));

  const { width, height } = chromiumPng;
  const diff = new PNG({ width, height });
  const result = pixelmatch(
    chromiumPng.data,
    webkitPng.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  console.log(`${result} pixels were different!`);
};
