import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_OPTIONS } from "./capture-options";
import { formatBaseResult, formatDiffDecorated, formatDiffPlain, formatJson, formatResult } from "./format";
import type { DiffComparison, DiffResult } from "./result";

const comparison = (overrides: Partial<DiffComparison> = {}): DiffComparison => ({
  browser: "webkit",
  pixelChange: 1104,
  pixelChangePercentage: 0.1198,
  width: 1280,
  height: 720,
  diffPath: null,
  ...overrides,
});

const diffResult = (overrides: Partial<DiffResult> = {}): DiffResult => ({
  schemaVersion: 1,
  command: "diff",
  runId: "20261028160312-a1b2c3",
  url: "http://localhost:3000/",
  base: "chromium",
  options: {
    ...DEFAULT_IMAGE_OPTIONS,
    browsers: ["chromium", "webkit", "firefox"],
    threshold: 0.2,
    failAbove: null,
    timeout: 30_000,
  },
  artifactsDir: null,
  screenshots: { chromium: null, webkit: null, firefox: null },
  comparisons: [comparison(), comparison({ browser: "firefox", pixelChange: 0, pixelChangePercentage: 0 })],
  timings: { totalMs: 4210, captureMs: { chromium: 1830, webkit: 2410, firefox: 3950 } },
  ...overrides,
});

describe("formatBaseResult", () => {
  it("should print nothing when the screenshot wasn't saved", () => {
    expect(formatBaseResult("chromium", null)).toEqual([]);
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
  const result = comparison({ browser: "firefox", pixelChange: 42, pixelChangePercentage: 1.23456 });

  it("should format the pixel change", () => {
    expect(formatResult("chromium", result)).toEqual([
      "┌─ 🦊 Firefox",
      "└─ 👉 1.23% pixel change compared to Chromium (42px)",
    ]);
  });

  it("should include the screenshot and diff paths when they were saved", () => {
    expect(formatResult("chromium", { ...result, diffPath: "/runs/1/diff.png" }, "/runs/1/firefox.png")).toEqual([
      "┌─ 🦊 Firefox",
      "├─ 👉 1.23% pixel change compared to Chromium (42px)",
      "├─ 👉 Screenshot stored at /runs/1/firefox.png",
      "└─ 👉 Visual diff stored at /runs/1/diff.png",
    ]);
  });

  it("should compare against the base browser", () => {
    expect(formatResult("webkit", { ...result, browser: "chromium" })).toEqual([
      "┌─ 🌐 Chromium",
      "└─ 👉 1.23% pixel change compared to WebKit (42px)",
    ]);
  });
});

describe("formatDiffDecorated", () => {
  it("should print a box per comparison", () => {
    expect(formatDiffDecorated(diffResult())).toEqual([
      "┌─ 🍎 WebKit",
      "└─ 👉 0.12% pixel change compared to Chromium (1104px)",
      "┌─ 🦊 Firefox",
      "└─ 👉 0.00% pixel change compared to Chromium (0px)",
    ]);
  });

  it("should print the saved screenshots", () => {
    const lines = formatDiffDecorated(
      diffResult({
        screenshots: { chromium: "/runs/1/chromium.png", webkit: "/runs/1/webkit.png" },
        comparisons: [comparison({ diffPath: "/runs/1/diff-chromium-webkit.png" })],
      }),
    );
    expect(lines).toEqual([
      "┌─ 🌐 Chromium (base)",
      "└─ 👉 Screenshot stored at /runs/1/chromium.png",
      "┌─ 🍎 WebKit",
      "├─ 👉 0.12% pixel change compared to Chromium (1104px)",
      "├─ 👉 Screenshot stored at /runs/1/webkit.png",
      "└─ 👉 Visual diff stored at /runs/1/diff-chromium-webkit.png",
    ]);
  });
});

describe("formatDiffPlain", () => {
  it("should print one line per comparison", () => {
    expect(formatDiffPlain(diffResult())).toEqual(["webkit 0.12% 1104px", "firefox 0.00% 0px"]);
  });

  it("should end each line with the diff path when it was saved", () => {
    expect(
      formatDiffPlain(diffResult({ comparisons: [comparison({ diffPath: "/runs/1/diff-chromium-webkit.png" })] })),
    ).toEqual(["webkit 0.12% 1104px /runs/1/diff-chromium-webkit.png"]);
  });
});

describe("formatJson", () => {
  it("should print the result as one JSON document", () => {
    const result = diffResult();
    const [document, ...rest] = formatJson(result);
    expect(rest).toEqual([]);
    expect(JSON.parse(document)).toEqual(result);
  });
});
