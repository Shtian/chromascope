import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { diff } from "../src/commands/diff";
import { type ChromascopeOptions, createChromascopeContext } from "../src/context";
import { parseCaptureOptions } from "../src/lib/capture-options";
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

  const run = (options: Partial<ChromascopeOptions> = {}) => {
    const ctx = createChromascopeContext({
      ...parseCaptureOptions({}, { browsers: ["chromium", "webkit", "firefox"] }),
      base: "chromium",
      verbose: false,
      threshold: 0.2,
      failAbove: null,
      folder: path.join(tempDir, "runs"),
      saveDiff: false,
      ...options,
    });
    const pending = diff(server.url, ctx).then(({ result }) => result);
    return { ctx, pending, result: pending.then((run) => run.comparisons) };
  };

  it("should compare WebKit and Firefox against Chromium and clean up after itself", async () => {
    const { ctx, pending } = run();
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
    expect(ctx.saveArtifacts).toBe(false);
    expect(server.cookies).toHaveLength(3);
    expect(listFiles(tempDir)).toEqual([]);
  });

  it("should save the screenshots and diffs with --save-diff", async () => {
    const { ctx, pending } = run({ saveDiff: true });
    const {
      comparisons: [webkit, firefox],
      screenshots,
      artifactsDir,
    } = await pending;

    expect(path.isAbsolute(ctx.runFolder)).toBe(true);
    expect(webkit.diffPath).toBe(path.join(ctx.runFolder, "diff-chromium-webkit.png"));
    expect(firefox.diffPath).toBe(path.join(ctx.runFolder, "diff-chromium-firefox.png"));
    expect(artifactsDir).toBe(ctx.runFolder);
    expect(screenshots).toEqual({
      chromium: path.join(ctx.runFolder, "chromium.png"),
      webkit: path.join(ctx.runFolder, "webkit.png"),
      firefox: path.join(ctx.runFolder, "firefox.png"),
    });
    expect(listFiles(ctx.runFolder)).toEqual([
      "chromium.png",
      "diff-chromium-firefox.png",
      "diff-chromium-webkit.png",
      "firefox.png",
      "webkit.png",
    ]);
    for (const browser of BROWSERS) {
      expect(readPngSize(path.join(ctx.runFolder, `${browser}.png`))).toEqual(VIEWPORT_SIZE);
    }
  });

  it("should screenshot only the element with --element", async () => {
    const { ctx, result } = run({ saveDiff: true, element: "#box" });
    const [webkit, firefox] = await result;

    for (const browser of BROWSERS) {
      expect(readPngSize(path.join(ctx.runFolder, `${browser}.png`))).toEqual(BOX_SIZE);
    }
    expect(readPngSize(webkit.diffPath ?? "")).toEqual(BOX_SIZE);
    expect(readPngSize(firefox.diffPath ?? "")).toEqual(BOX_SIZE);
    expect(webkit).toMatchObject(BOX_SIZE);
  });

  it("should screenshot the whole page with --full-page", async () => {
    const { ctx, result } = run({ saveDiff: true, fullPage: true });
    await result;

    for (const browser of BROWSERS) {
      const size = readPngSize(path.join(ctx.runFolder, `${browser}.png`));
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
