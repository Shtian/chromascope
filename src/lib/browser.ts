import type { Browser, BrowserType } from "playwright";

/** Launches a browser, runs `fn` with it, and always closes it afterwards. */
export const withBrowser = async <T>(browserType: BrowserType, fn: (browser: Browser) => Promise<T>) => {
  const browser = await launch(browserType);
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
};

const launch = async (browserType: BrowserType) => {
  try {
    return await browserType.launch();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
      throw new Error(`${browserType.name()} is not installed. Run \`chromascope install\` to install the browsers.`, {
        cause: error,
      });
    }
    throw error;
  }
};
