import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { diff } from "../src/commands/diff";
import { type ChromascopeOptions, createChromascopeContext } from "../src/context";
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
    const ctx = createChromascopeContext(
      {
        verbose: false,
        threshold: 0.2,
        folder: path.join(tempDir, "runs"),
        saveDiff: false,
        element: "",
        fullPage: false,
        cookie: "",
        ...options,
      },
      ora({ isEnabled: false }),
    );
    return { ctx, result: diff(server.url, ctx) };
  };

  it("should compare WebKit and Firefox against Chromium and clean up after itself", async () => {
    const result = await run().result;

    expect(result.map((r) => r.browserName)).toEqual(["🍎 WebKit", "🦊 Firefox"]);
    for (const r of result) {
      expect(r.pixelChange).toBeGreaterThanOrEqual(0);
      expect(r.pixelChangePercentage).toBeGreaterThanOrEqual(0);
      expect(r.pixelChangePercentage).toBeLessThanOrEqual(100);
      expect(r.diffPath).toBe("");
    }
    expect(server.cookies).toHaveLength(3);
    expect(listFiles(tempDir)).toEqual([]);
  });

  it("should save the screenshots and diffs with --save-diff", async () => {
    const { ctx, result } = run({ saveDiff: true });
    const [webkit, firefox] = await result;

    expect(webkit.diffPath).toBe(`${ctx.runFolder}/diff-chromium-webkit.png`);
    expect(firefox.diffPath).toBe(`${ctx.runFolder}/diff-chromium-firefox.png`);
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
    expect(readPngSize(webkit.diffPath)).toEqual(BOX_SIZE);
    expect(readPngSize(firefox.diffPath)).toEqual(BOX_SIZE);
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
