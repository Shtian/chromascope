import type { BrowserType } from "playwright";
import { withBrowser } from "./browser";
import type { BrowserName, CaptureOptions } from "./capture-options";
import type { Capturer } from "./capturer";
import { navigationError, selectorError } from "./errors";
import { parseCookieOptions } from "./utils";

/**
 * The Playwright capturer: launches the browser, captures the page and closes the browser again.
 * Animations are disabled and the caret is hidden, so repeated captures of an unchanged page match.
 */
export const playwrightCapturer =
  (browserTypes: Record<BrowserName, BrowserType>): Capturer =>
  (browserName: BrowserName, url: string, options: CaptureOptions) =>
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
