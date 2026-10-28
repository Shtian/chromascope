import { type BrowserType, chromium, firefox, webkit } from "playwright";
import { withBrowser } from "./browser";
import type { BrowserName, CaptureOptions } from "./capture-options";
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
    await page.goto(url, { waitUntil: options.waitUntil });
    if (options.waitFor) await page.locator(options.waitFor).first().waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);

    const screenshotOptions = { path, animations: "disabled", caret: "hide" } as const;
    return options.element
      ? await page.locator(options.element).first().screenshot(screenshotOptions)
      : await page.screenshot({ ...screenshotOptions, fullPage: options.fullPage });
  });
