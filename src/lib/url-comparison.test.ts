import { describe, expect, it } from "vitest";
import type { BrowserName } from "./capture-options";
import { pairCaptures } from "./url-comparison";

const capture = (browser: BrowserName, image: string, ms: number) => ({
  browser,
  image: Buffer.from(image),
  ms,
});

describe("pairCaptures", () => {
  it("should pair each browser's capture of the before URL with its capture of the after URL", () => {
    const pairs = pairCaptures(
      [capture("chromium", "before chromium", 100), capture("firefox", "before firefox", 300)],
      [capture("firefox", "after firefox", 400), capture("chromium", "after chromium", 200)],
    );
    expect(pairs).toEqual([
      { browser: "chromium", before: Buffer.from("before chromium"), after: Buffer.from("after chromium"), ms: 300 },
      { browser: "firefox", before: Buffer.from("before firefox"), after: Buffer.from("after firefox"), ms: 700 },
    ]);
  });

  it("should fail when a browser has no capture of the after URL", () => {
    expect(() => pairCaptures([capture("webkit", "before", 1)], [capture("chromium", "after", 1)])).toThrow(
      "webkit has no capture of the after URL",
    );
  });
});
