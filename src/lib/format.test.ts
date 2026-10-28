import { describe, expect, it } from "vitest";
import type { BrowserComparison } from "../commands/diff";
import { formatBaseResult, formatDiffDecorated, formatDiffPlain, formatResult } from "./format";

describe("formatBaseResult", () => {
  it("should print nothing when the screenshot wasn't saved", () => {
    expect(formatBaseResult("chromium", "")).toEqual([]);
  });

  it("should print the base screenshot path", () => {
    expect(formatBaseResult("chromium", "/runs/1/chromium.png")).toEqual([
      "┌─ 🌐 Chromium (base)",
      "└─ 👉 Screenshot stored at /runs/1/chromium.png",
    ]);
  });

  it("should name the base browser", () => {
    expect(formatBaseResult("webkit", "/runs/1/webkit.png")[0]).toBe("┌─ 🍎 WebKit (base)");
  });
});

describe("formatResult", () => {
  const result = { browser: "firefox", pixelChange: 42, pixelChangePercentage: 1.23456 };

  it("should format the pixel change", () => {
    expect(formatResult("chromium", { ...result, diffPath: "", screenshotPath: "" })).toEqual([
      "┌─ 🦊 Firefox",
      "└─ 👉 1.23% pixel change compared to Chromium (42px)",
    ]);
  });

  it("should include the screenshot and diff paths when they were saved", () => {
    expect(
      formatResult("chromium", { ...result, diffPath: "/runs/1/diff.png", screenshotPath: "/runs/1/firefox.png" }),
    ).toEqual([
      "┌─ 🦊 Firefox",
      "├─ 👉 1.23% pixel change compared to Chromium (42px)",
      "├─ 👉 Screenshot stored at /runs/1/firefox.png",
      "└─ 👉 Visual diff stored at /runs/1/diff.png",
    ]);
  });

  it("should compare against the base browser", () => {
    expect(formatResult("webkit", { ...result, browser: "chromium", diffPath: "", screenshotPath: "" })).toEqual([
      "┌─ 🌐 Chromium",
      "└─ 👉 1.23% pixel change compared to WebKit (42px)",
    ]);
  });
});

const comparison = (overrides: Partial<BrowserComparison> = {}): BrowserComparison => ({
  browser: "webkit",
  pixelChange: 1104,
  pixelChangePercentage: 0.1198,
  width: 1280,
  height: 720,
  diffPath: "",
  screenshotPath: "",
  ...overrides,
});

describe("formatDiffDecorated", () => {
  it("should print the base browser and a box per comparison", () => {
    expect(
      formatDiffDecorated({
        base: "chromium",
        baseScreenshotPath: "/runs/1/chromium.png",
        comparisons: [comparison(), comparison({ browser: "firefox", pixelChange: 0, pixelChangePercentage: 0 })],
      }),
    ).toEqual([
      "┌─ 🌐 Chromium (base)",
      "└─ 👉 Screenshot stored at /runs/1/chromium.png",
      "┌─ 🍎 WebKit",
      "└─ 👉 0.12% pixel change compared to Chromium (1104px)",
      "┌─ 🦊 Firefox",
      "└─ 👉 0.00% pixel change compared to Chromium (0px)",
    ]);
  });
});

describe("formatDiffPlain", () => {
  it("should print one line per comparison", () => {
    expect(
      formatDiffPlain({
        base: "chromium",
        baseScreenshotPath: "",
        comparisons: [comparison(), comparison({ browser: "firefox", pixelChange: 0, pixelChangePercentage: 0 })],
      }),
    ).toEqual(["webkit 0.12% 1104px", "firefox 0.00% 0px"]);
  });

  it("should end each line with the diff path when it was saved", () => {
    expect(
      formatDiffPlain({
        base: "chromium",
        baseScreenshotPath: "/runs/1/chromium.png",
        comparisons: [comparison({ diffPath: "/runs/1/diff-chromium-webkit.png" })],
      }),
    ).toEqual(["webkit 0.12% 1104px /runs/1/diff-chromium-webkit.png"]);
  });
});
