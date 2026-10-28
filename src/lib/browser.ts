import type { Browser, BrowserType } from "playwright";
import { runtimeError } from "./errors";

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
      throw runtimeError(
        "BROWSER_NOT_INSTALLED",
        `${browserType.name()} is not installed`,
        "run `chromascope install` to install the browsers",
        { cause: error },
      );
    }
    throw error;
  }
};
