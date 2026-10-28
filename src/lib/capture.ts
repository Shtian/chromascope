import { type BrowserType, chromium, firefox, webkit } from "playwright";
import { withBrowser } from "./browser";
import type { BrowserName, CaptureOptions } from "./capture-options";
import { navigationError, selectorError } from "./errors";
import { parseCookieOptions } from "./utils";

const browserTypes: Record<BrowserName, BrowserType> = { chromium, webkit, firefox };

/**
 * Captures the page in one browser and returns the PNG. Writes it to `path` too when given.
 * Animations are disabled and the caret is hidden, so repeated captures of an unchanged page match.
 */
export const capturePage = (browserName: BrowserName, url: string, options: CaptureOptions, path?: string) =>
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

    const screenshotOptions = { path, animations: "disabled", caret: "hide" } as const;
    if (!element) return await page.screenshot({ ...screenshotOptions, fullPage: options.fullPage });
    return await page
      .locator(element)
      .first()
      .screenshot(screenshotOptions)
      .catch((error) => {
        throw selectorError(error, element, options.timeout);
      });
  });
