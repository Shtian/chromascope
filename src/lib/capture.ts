import { type BrowserType, chromium, firefox, webkit } from "playwright";
import { withBrowser } from "./browser";
import type { BrowserName, CaptureOptions } from "./capture-options";
import { navigationError, selectorError } from "./errors";
import output from "./output";
import { parseCookieOptions } from "./utils";

const browserTypes: Record<BrowserName, BrowserType> = { chromium, webkit, firefox };

/**
 * Captures the page in one browser and returns the PNG.
 * Animations are disabled and the caret is hidden, so repeated captures of an unchanged page match.
 */
export const capturePage = (browserName: BrowserName, url: string, options: CaptureOptions) =>
  withBrowser(browserTypes[browserName], async (browser) => {
    const context = await browser.newContext({
      viewport: options.viewport,
      deviceScaleFactor: options.deviceScaleFactor,
    });
    context.setDefaultTimeout(options.timeout);
    context.setDefaultNavigationTimeout(options.timeout);
    if (options.cookie) await context.addCookies(parseCookieOptions(options.cookie, url));

    const page = await context.newPage();
    await page.goto(url, { waitUntil: options.waitUntil }).catch((error) => {
      throw navigationError(error, url, options.timeout);
    });
    const { waitFor, element } = options;
    if (waitFor) {
      await page
        .locator(waitFor)
        .first()
        .waitFor({ state: "visible" })
        .catch((error) => {
          throw selectorError(error, waitFor, options.timeout);
        });
    }
    await page.evaluate(() => document.fonts.ready);

    const mask = options.mask.map((selector) => page.locator(selector));
    const screenshotOptions = { animations: "disabled", caret: "hide", mask } as const;
    if (!element) return await page.screenshot({ ...screenshotOptions, fullPage: options.fullPage });
    return await page
      .locator(element)
      .first()
      .screenshot(screenshotOptions)
      .catch((error) => {
        throw selectorError(error, element, options.timeout);
      });
  });

export type Capture = { browser: BrowserName; image: Buffer; ms: number };

/**
 * Captures the page in every browser at once, showing progress.
 * Waits for every capture to settle, so no browser is left running, then throws the first failure.
 */
export const captureAll = async (browsers: BrowserName[], url: string, options: CaptureOptions): Promise<Capture[]> => {
  const results = await Promise.allSettled(browsers.map((browser) => capture(browser, url, options)));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<Capture>).value);
};

const capture = async (browser: BrowserName, url: string, options: CaptureOptions) => {
  const step = output.step(`Capturing ${browser} screenshot`, "📷");
  const started = performance.now();
  try {
    const image = await capturePage(browser, url, options);
    step.succeed(`Captured ${browser} screenshot`, "📸");
    return { browser, image, ms: Math.round(performance.now() - started) };
  } catch (error) {
    step.fail(`Failed to capture ${browser} screenshot`);
    throw error;
  }
};
