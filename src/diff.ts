import { webkit, firefox, chromium, Browser } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "fs";

interface DiffOptions {
  verbose: boolean;
  runId: string;
}

export const diff = async (link: string, options: DiffOptions) => {
  await diffWebkit(link, options);
  await diffFirefox(link, options);
  await diffChromium(link, options);
  await diffChromiumToWebkit(options);
  return true;
};

const diffWebkit = async (link: string, options: DiffOptions) => {
  const browser = await webkit.launch();
  await runBrowserDiff(link, browser, options);
};

const diffFirefox = async (link: string, options: DiffOptions) => {
  const browser = await firefox.launch();
  await runBrowserDiff(link, browser, options);
};

const diffChromium = async (link: string, options: DiffOptions) => {
  const browser = await chromium.launch();
  await runBrowserDiff(link, browser, options);
};

const runBrowserDiff = async (
  link: string,
  browser: Browser,
  options: DiffOptions
) => {
  const context = await browser.newContext();
  const type = browser.browserType();
  const name = type.name();
  const page = await context.newPage();
  await page.goto(link);
  const path = `runs/${options.runId}/${name}.png`;
  if (options.verbose) {
    console.log(`Saving ${name} screenshot to ${path}`);
  }
  await page.screenshot({ path });
};

const diffChromiumToWebkit = (options: DiffOptions) => {
  const baseFolder = `chromascope-runs`;
  const chromiumPath = `${baseFolder}/${options.runId}/chromium.png`;
  const webkitPath = `${baseFolder}/${options.runId}/webkit.png`;
  const diffPath = `${baseFolder}/${options.runId}/diff.png`;

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
