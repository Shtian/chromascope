import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { diff } from "../src/commands/diff";
import { playwrightCapturer } from "../src/lib/capture";
import { type CaptureOptions, parseCaptureOptions } from "../src/lib/capture-options";
import output from "../src/lib/output";
import {
  BOX_SIZE,
  createTempDir,
  type FixtureServer,
  listFiles,
  PAGE_HEIGHT,
  readPngSize,
  startFixtureServer,
  VIEWPORT_SIZE,
} from "./fixture-server";

const BROWSERS = ["chromium", "firefox", "webkit"];
const capturer = playwrightCapturer({ chromium, firefox, webkit });

describe("diff", () => {
  let server: FixtureServer;
  let tempDir: string;

  beforeAll(async () => {
    output.configure({ quiet: true });
    server = await startFixtureServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    tempDir = createTempDir();
    server.cookies.length = 0;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const run = (capture: Partial<CaptureOptions> = {}, saveDiff = false) => {
    const pending = diff(
      server.url,
      {
        capture: { ...parseCaptureOptions({}, { browsers: ["chromium", "webkit", "firefox"] }), ...capture },
        base: "chromium",
        threshold: 0.2,
        failAbove: null,
        saveDiff,
        run: { folder: path.join(tempDir, "runs") },
      },
      capturer,
    ).then(({ result }) => result);
    return { pending, result: pending.then((run) => run.comparisons) };
  };

  /** The run folder the diff wrote its artifacts to. */
  const runFolderOf = async (pending: ReturnType<typeof run>["pending"]) => (await pending).artifactsDir ?? "";

  it("should compare WebKit and Firefox against Chromium and clean up after itself", async () => {
    const { pending } = run();
    const { comparisons: result, screenshots, artifactsDir } = await pending;

    expect(result.map((r) => r.browser)).toEqual(["webkit", "firefox"]);
    for (const r of result) {
      expect(r.pixelChange).toBeGreaterThanOrEqual(0);
      expect(r.pixelChangePercentage).toBeGreaterThanOrEqual(0);
      expect(r.pixelChangePercentage).toBeLessThanOrEqual(100);
      expect(r.diffPath).toBeNull();
    }
    expect(screenshots).toEqual({ chromium: null, webkit: null, firefox: null });
    expect(artifactsDir).toBeNull();
    expect(server.cookies).toHaveLength(3);
    expect(listFiles(tempDir)).toEqual([]);
  });

  it("should save the screenshots and diffs with --save-diff", async () => {
    const { pending } = run({}, true);
    const {
      runId,
      comparisons: [webkit, firefox],
      screenshots,
      artifactsDir,
    } = await pending;
    const runFolder = artifactsDir ?? "";

    expect(artifactsDir).toBe(path.join(tempDir, "runs", runId));
    expect(webkit.diffPath).toBe(path.join(runFolder, "diff-chromium-webkit.png"));
    expect(firefox.diffPath).toBe(path.join(runFolder, "diff-chromium-firefox.png"));
    expect(screenshots).toEqual({
      chromium: path.join(runFolder, "chromium.png"),
      webkit: path.join(runFolder, "webkit.png"),
      firefox: path.join(runFolder, "firefox.png"),
    });
    expect(listFiles(runFolder)).toEqual([
      "chromium.png",
      "diff-chromium-firefox.png",
      "diff-chromium-webkit.png",
      "firefox.png",
      "webkit.png",
    ]);
    for (const browser of BROWSERS) {
      expect(readPngSize(path.join(runFolder, `${browser}.png`))).toEqual(VIEWPORT_SIZE);
    }
  });

  it("should screenshot only the element with --element", async () => {
    const { pending, result } = run({ element: "#box" }, true);
    const [webkit, firefox] = await result;
    const runFolder = await runFolderOf(pending);

    for (const browser of BROWSERS) {
      expect(readPngSize(path.join(runFolder, `${browser}.png`))).toEqual(BOX_SIZE);
    }
    expect(readPngSize(webkit.diffPath ?? "")).toEqual(BOX_SIZE);
    expect(readPngSize(firefox.diffPath ?? "")).toEqual(BOX_SIZE);
    expect(webkit).toMatchObject(BOX_SIZE);
  });

  it("should screenshot the whole page with --full-page", async () => {
    const runFolder = await runFolderOf(run({ fullPage: true }, true).pending);

    for (const browser of BROWSERS) {
      const size = readPngSize(path.join(runFolder, `${browser}.png`));
      expect(size.width).toBe(VIEWPORT_SIZE.width);
      expect(size.height).toBeGreaterThanOrEqual(PAGE_HEIGHT);
    }
  });

  it("should send the cookies from --cookie in every browser", async () => {
    await run({ cookie: "flavour=chocolate; size=large" }).result;

    expect(server.cookies).toHaveLength(3);
    for (const cookie of server.cookies) {
      expect(cookie?.split("; ").sort()).toEqual(["flavour=chocolate", "size=large"]);
    }
  });
});
