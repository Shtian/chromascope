import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BLUE, failingCapturer, fakeCapturer, png, RED } from "../../test/fake-capturer";
import { type BrowserName, type CaptureOptions, parseCaptureOptions } from "./capture-options";
import type { Capturer } from "./capturer";
import { compareBeforeAfter, pairCaptures, runComparison } from "./comparison-run";
import { DEFAULT_IMAGE_OPTIONS } from "./image-options";
import output from "./output";

const BEFORE_URL = "http://localhost:3000/";
const AFTER_URL = "http://localhost:4000/";

const captureOptions = (browsers: BrowserName[], overrides: Partial<CaptureOptions> = {}) => ({
  ...parseCaptureOptions({}, { browsers }),
  cookie: "session=abc",
  ...overrides,
});

describe("runComparison", () => {
  let tempDir: string;
  let folder: string;

  beforeAll(() => {
    output.configure({ quiet: true });
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-"));
    folder = path.join(tempDir, "runs");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const listFiles = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);

  describe("cross-browser diff", () => {
    const diff = (capturer: Capturer, { save = false, out }: { save?: boolean; out?: string } = {}) =>
      runComparison(
        {
          command: "diff",
          fields: { url: BEFORE_URL, base: "firefox" as const },
          url: BEFORE_URL,
          before: { kind: "base-browser", base: "firefox", save },
          capture: captureOptions(["chromium", "firefox", "webkit"]),
          threshold: 0.2,
          failAbove: null,
          run: { folder, out },
        },
        capturer,
      );

    it("should compare every other browser against the base browser, captured first", async () => {
      const { capturer, calls } = fakeCapturer({ [`webkit ${BEFORE_URL}`]: png(4, 2, BLUE) });
      const { result, aboveFailAbove } = await diff(capturer);

      expect(calls).toEqual([`firefox ${BEFORE_URL}`, `chromium ${BEFORE_URL}`, `webkit ${BEFORE_URL}`]);
      expect(result.options.browsers).toEqual(["firefox", "chromium", "webkit"]);
      expect(result.comparisons).toEqual([
        { browser: "chromium", pixelChange: 0, pixelChangePercentage: 0, width: 4, height: 2, diffPath: null },
        { browser: "webkit", pixelChange: 8, pixelChangePercentage: 100, width: 4, height: 2, diffPath: null },
      ]);
      expect(aboveFailAbove).toBe(false);
    });

    it("should write nothing without --save-diff or --out", async () => {
      const { result } = await diff(fakeCapturer().capturer);

      expect(result.artifactsDir).toBeNull();
      expect(result.screenshots).toEqual({ firefox: null, chromium: null, webkit: null });
      expect(listFiles(tempDir)).toEqual([]);
    });

    it("should write the screenshots and the diffs against the base browser with --save-diff", async () => {
      const { result } = await diff(fakeCapturer().capturer, { save: true });
      const dir = path.join(folder, result.runId);

      expect(result.artifactsDir).toBe(dir);
      expect(result.screenshots).toEqual({
        firefox: path.join(dir, "firefox.png"),
        chromium: path.join(dir, "chromium.png"),
        webkit: path.join(dir, "webkit.png"),
      });
      expect(result.comparisons.map(({ diffPath }) => diffPath)).toEqual([
        path.join(dir, "diff-firefox-chromium.png"),
        path.join(dir, "diff-firefox-webkit.png"),
      ]);
      expect(listFiles(dir)).toEqual([
        "chromium.png",
        "diff-firefox-chromium.png",
        "diff-firefox-webkit.png",
        "firefox.png",
        "webkit.png",
      ]);
    });

    it("should write to --out without --save-diff", async () => {
      const out = path.join(tempDir, "out");
      const { result } = await diff(fakeCapturer().capturer, { out });

      expect(result.artifactsDir).toBe(out);
      expect(listFiles(out)).toHaveLength(5);
    });

    it("should time every capture, the base browser's too", async () => {
      const { result } = await diff(fakeCapturer().capturer);
      expect(Object.keys(result.timings.captureMs)).toEqual(["firefox", "chromium", "webkit"]);
    });
  });

  describe("before/after comparison", () => {
    const baselines: Partial<Record<BrowserName, Buffer>> = { chromium: png(4, 2, RED), firefox: png(4, 2, BLUE) };

    const compare = (capturer: Capturer, failAbove: number | null = null) =>
      runComparison(
        {
          command: "compare",
          fields: { name: "home" },
          url: BEFORE_URL,
          before: { kind: "baseline", image: (browser) => baselines[browser] ?? Buffer.from("") },
          capture: captureOptions(["chromium", "firefox"]),
          threshold: 0.2,
          failAbove,
          run: { folder },
        },
        capturer,
      );

    it("should compare each browser's capture against its baseline and write the before, after and diff images", async () => {
      const { result, captures } = await compare(fakeCapturer().capturer);
      const dir = path.join(folder, result.runId);

      expect(result.artifactsDir).toBe(dir);
      expect(result.comparisons).toEqual([
        expect.objectContaining({ browser: "chromium", pixelChange: 0, sizeChanged: false }),
        expect.objectContaining({
          browser: "firefox",
          pixelChange: 8,
          pixelChangePercentage: 100,
          diffPath: path.join(dir, "diff-firefox.png"),
        }),
      ]);
      expect(listFiles(dir)).toEqual([
        "after-chromium.png",
        "after-firefox.png",
        "before-chromium.png",
        "before-firefox.png",
        "diff-chromium.png",
        "diff-firefox.png",
      ]);
      expect(fs.readFileSync(path.join(dir, "before-firefox.png"))).toEqual(baselines.firefox);
      expect(captures.map(({ browser }) => browser)).toEqual(["chromium", "firefox"]);
    });

    it("should report whether a comparison is above --fail-above", async () => {
      expect((await compare(fakeCapturer().capturer, 100)).aboveFailAbove).toBe(false);
      expect((await compare(fakeCapturer().capturer, 99.9)).aboveFailAbove).toBe(true);
    });
  });

  describe("URL comparison", () => {
    const versus = (capturer: Capturer) =>
      runComparison(
        {
          command: "versus",
          fields: { beforeUrl: BEFORE_URL, afterUrl: AFTER_URL },
          url: AFTER_URL,
          before: { kind: "url", url: BEFORE_URL },
          capture: captureOptions(["chromium", "webkit"]),
          threshold: 0.2,
          failAbove: 0,
          run: { folder },
        },
        capturer,
      );

    it("should capture the before URL first, then compare each browser's capture of the after URL against it", async () => {
      const { capturer, calls } = fakeCapturer({ [`webkit ${AFTER_URL}`]: png(4, 2, BLUE) });
      const { result, aboveFailAbove, captures } = await versus(capturer);

      expect(calls).toEqual([
        `chromium ${BEFORE_URL}`,
        `webkit ${BEFORE_URL}`,
        `chromium ${AFTER_URL}`,
        `webkit ${AFTER_URL}`,
      ]);
      expect(result.comparisons.map(({ browser, pixelChange }) => [browser, pixelChange])).toEqual([
        ["chromium", 0],
        ["webkit", 8],
      ]);
      expect(aboveFailAbove).toBe(true);
      expect(captures.map(({ browser }) => browser)).toEqual(["chromium", "webkit"]);
      expect(listFiles(path.join(folder, result.runId))).toHaveLength(6);
    });

    it("should time both captures of each browser", async () => {
      const { result } = await versus(fakeCapturer().capturer);
      expect(Object.keys(result.timings.captureMs)).toEqual(["chromium", "webkit"]);
    });
  });

  it("should lead the result with the schema version, the command, the run ID and the command's fields", async () => {
    const { result } = await runComparison(
      {
        command: "versus",
        fields: { beforeUrl: BEFORE_URL, afterUrl: AFTER_URL },
        url: AFTER_URL,
        before: { kind: "url", url: BEFORE_URL },
        capture: captureOptions(["chromium"], { element: "#box" }),
        threshold: 0.1,
        failAbove: 2,
        run: { folder },
      },
      fakeCapturer().capturer,
    );

    expect(Object.keys(result)).toEqual([
      "schemaVersion",
      "command",
      "runId",
      "beforeUrl",
      "afterUrl",
      "options",
      "artifactsDir",
      "comparisons",
      "timings",
    ]);
    expect(result).toMatchObject({ schemaVersion: 1, command: "versus", runId: expect.stringMatching(/^\d{14}-/) });
    expect(result.options).toEqual({
      ...DEFAULT_IMAGE_OPTIONS,
      element: "#box",
      browsers: ["chromium"],
      threshold: 0.1,
      failAbove: 2,
      timeout: 30_000,
    });
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("should leave no run folder behind when a capture fails", async () => {
    const failing = runComparison(
      {
        command: "compare",
        fields: {},
        url: BEFORE_URL,
        before: { kind: "baseline", image: () => png(4, 2, RED) },
        capture: captureOptions(["chromium"]),
        threshold: 0.2,
        failAbove: null,
        run: { folder },
      },
      failingCapturer,
    );

    await expect(failing).rejects.toThrow("chromium failed");
    expect(listFiles(tempDir)).toEqual([]);
  });
});

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

describe("compareBeforeAfter", () => {
  const runFolder = "/runs/1";

  it("should report no change for identical images, and name the files to write", () => {
    const image = png(4, 2, RED);
    const { comparison, files } = compareBeforeAfter("firefox", image, image, runFolder, 0.2);
    expect(comparison).toEqual({
      browser: "firefox",
      pixelChange: 0,
      pixelChangePercentage: 0,
      before: { width: 4, height: 2 },
      after: { width: 4, height: 2 },
      sizeChanged: false,
      beforePath: path.join(runFolder, "before-firefox.png"),
      afterPath: path.join(runFolder, "after-firefox.png"),
      diffPath: path.join(runFolder, "diff-firefox.png"),
    });
    expect(files.map(([name]) => path.join(runFolder, name))).toEqual([
      comparison.beforePath,
      comparison.afterPath,
      comparison.diffPath,
    ]);
    expect(files[0][1]).toBe(image);
    expect(files[1][1]).toBe(image);
    expect(PNG.sync.read(files[2][1])).toMatchObject({ width: 4, height: 2 });
  });

  it("should count changed pixels", () => {
    const { comparison } = compareBeforeAfter("chromium", png(2, 2, RED), png(2, 2, BLUE), runFolder, 0.2);
    expect(comparison).toMatchObject({ pixelChange: 4, pixelChangePercentage: 100, sizeChanged: false });
  });

  it("should flag a size change and count the added area as changed", () => {
    const { comparison, files } = compareBeforeAfter("chromium", png(2, 2, RED), png(2, 4, RED), runFolder, 0.2);
    expect(comparison).toMatchObject({
      before: { width: 2, height: 2 },
      after: { width: 2, height: 4 },
      sizeChanged: true,
      pixelChange: 4,
    });
    expect(PNG.sync.read(files[2][1])).toMatchObject({ width: 2, height: 4 });
  });
});
