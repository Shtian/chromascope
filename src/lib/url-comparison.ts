import type { BrowserName } from "./capture-options";

type BrowserCapture = { browser: BrowserName; image: Buffer; ms: number };

/**
 * Pairs each browser's capture of the before URL with the same browser's capture of the after URL, in the order of the
 * before captures. A URL comparison never compares across browsers. `ms` is the time both captures took.
 */
export const pairCaptures = (before: BrowserCapture[], after: BrowserCapture[]) =>
  before.map(({ browser, image, ms }) => {
    const other = after.find((capture) => capture.browser === browser);
    if (!other) throw new Error(`${browser} has no capture of the after URL`);
    return { browser, before: image, after: other.image, ms: ms + other.ms };
  });
