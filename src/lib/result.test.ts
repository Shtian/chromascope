import { describe, expect, it } from "vitest";
import { byBrowser, timingsOf } from "./result";

const captures = [
  { browser: "chromium" as const, image: Buffer.from("chromium"), ms: 1830 },
  { browser: "webkit" as const, image: Buffer.from("webkit"), ms: 2410 },
];

describe("byBrowser", () => {
  it("should key a value per item by its browser, in order", () => {
    const record = byBrowser(captures, ({ ms }) => ms * 2);
    expect(record).toEqual({ chromium: 3660, webkit: 4820 });
    expect(Object.keys(record)).toEqual(["chromium", "webkit"]);
  });

  it("should be empty without items", () => {
    expect(byBrowser([], () => 1)).toEqual({});
  });
});

describe("timingsOf", () => {
  it("should round the total time since the start and keep each browser's capture time", () => {
    expect(timingsOf(100.2, captures, 4310.6)).toEqual({ totalMs: 4210, captureMs: { chromium: 1830, webkit: 2410 } });
  });
});
