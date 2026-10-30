import type { BrowserName, CaptureOptions } from "./capture-options";
import output from "./output";

/**
 * Captures the page in one browser and returns the PNG. The seam between chromascope and the browsers: Playwright in
 * production (`capture.ts`), a fake that returns fixed PNGs in unit tests.
 */
export type Capturer = (browser: BrowserName, url: string, options: CaptureOptions) => Promise<Buffer>;

export type Capture = { browser: BrowserName; image: Buffer; ms: number };

/**
 * Captures the page in every browser at once, showing progress.
 * Waits for every capture to settle, so no browser is left running, then throws the first failure.
 */
export const captureAll = async (
  capturer: Capturer,
  browsers: BrowserName[],
  url: string,
  options: CaptureOptions,
): Promise<Capture[]> => {
  const results = await Promise.allSettled(browsers.map((browser) => capture(capturer, browser, url, options)));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<Capture>).value);
};

const capture = async (capturer: Capturer, browser: BrowserName, url: string, options: CaptureOptions) => {
  const step = output.step(`Capturing ${browser} screenshot`, "📷");
  const started = performance.now();
  try {
    const image = await capturer(browser, url, options);
    step.succeed(`Captured ${browser} screenshot`, "📸");
    return { browser, image, ms: Math.round(performance.now() - started) };
  } catch (error) {
    step.fail(`Failed to capture ${browser} screenshot`);
    throw error;
  }
};
