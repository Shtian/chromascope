import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BOX_SIZE, createTempDir, type FixtureServer, listFiles, startFixtureServer } from "./fixture-server";
import { runCli } from "./run-cli";

/** Changes the colour of `#box`, so the after page differs from the before page. */
const BOX_CHANGE = "#box { background: #0c0; }";

/** Two servers of the same fixture page, standing in for production and a local build. */
let before: FixtureServer;
let after: FixtureServer;
let tempDir: string;

beforeAll(async () => {
  [before, after] = await Promise.all([startFixtureServer(), startFixtureServer()]);
});

afterAll(async () => {
  await Promise.all([before.close(), after.close()]);
});

beforeEach(() => {
  tempDir = createTempDir();
  for (const server of [before, after]) {
    server.css = "";
    server.cookies.length = 0;
  }
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const chromascope = (...args: string[]) => runCli(tempDir, ...args);
const real = (...segments: string[]) => path.join(fs.realpathSync(tempDir), ...segments);
const json = async (...args: string[]) => {
  const run = await chromascope(...args, "--json");
  return { ...run, result: JSON.parse(run.stdout) };
};

describe("versus", () => {
  it("should compare each default browser's captures of the two URLs, and accept the vs alias", async () => {
    const versus = await chromascope("versus", before.url, after.url);
    expect(versus.code).toBe(0);
    expect(versus.stdout).toMatch(
      /^chromium 0\.00% 0px 1280x720->1280x720 same-size \S+\nwebkit 0\.00% 0px .+\nfirefox 0\.00% 0px .+\n$/,
    );

    const vs = await chromascope("vs", before.url, after.url, "--browsers", "firefox");
    expect(vs.code).toBe(0);
    expect(vs.stdout).toMatch(/^firefox 0\.00% 0px \S+ same-size \S+\n$/);
  });

  it("should show no change for the same URL twice", async () => {
    const { code, result } = await json(
      "versus",
      before.url,
      before.url,
      "--browsers",
      "chromium",
      "--fail-above",
      "0",
    );
    expect(code).toBe(0);
    expect(result).toMatchObject({ beforeUrl: before.url, afterUrl: before.url });
    expect(result.comparisons[0].pixelChange).toBe(0);
  });

  it("should exit 1 above --fail-above and keep the before, after and diff images of each browser", async () => {
    after.css = BOX_CHANGE;
    const { code, stdout } = await chromascope(
      "versus",
      before.url,
      after.url,
      "--browsers",
      "chromium,webkit",
      "--fail-above",
      "0",
    );
    expect(code).toBe(1);
    expect(stdout).toMatch(/^chromium \d+\.\d\d% [1-9]\d*px .+\nwebkit \d+\.\d\d% [1-9]\d*px .+\n$/);

    const [runId] = fs.readdirSync(real("chromascope-runs"));
    expect(listFiles(real("chromascope-runs", runId))).toEqual([
      "after-chromium.png",
      "after-webkit.png",
      "before-chromium.png",
      "before-webkit.png",
      "diff-chromium.png",
      "diff-webkit.png",
    ]);
  });

  it("should exit 0 within --fail-above, and write the images to exactly --out", async () => {
    after.css = BOX_CHANGE;
    const { code } = await chromascope(
      "versus",
      before.url,
      after.url,
      "--browsers",
      "chromium",
      "--fail-above",
      "100",
      "--out",
      "out",
    );
    expect(code).toBe(0);
    expect(listFiles(real("out"))).toEqual(["after-chromium.png", "before-chromium.png", "diff-chromium.png"]);
  });

  it("should capture both URLs with the same capture options", async () => {
    after.css = "#tall { background: #0c0; }";
    const { code, result } = await json("versus", before.url, after.url, "--browsers", "chromium", "--element", "#box");
    expect(code).toBe(0);
    expect(result.comparisons[0]).toMatchObject({ pixelChange: 0, before: BOX_SIZE, after: BOX_SIZE });
  });

  it("should send the --cookie list to both URLs", async () => {
    await chromascope("versus", before.url, after.url, "--browsers", "chromium", "--cookie", "flavour=chocolate");
    expect(before.cookies).toEqual(["flavour=chocolate"]);
    expect(after.cookies).toEqual(["flavour=chocolate"]);
  });

  it("should print one JSON document with both URLs and no baseline fields", async () => {
    after.css = BOX_CHANGE;
    const { code, stdout, stderr, result } = await json("versus", before.url, after.url, "--browsers", "chromium");
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.trim().startsWith("{")).toBe(true);
    expect(result).toEqual({
      schemaVersion: 1,
      command: "versus",
      runId: expect.stringMatching(/^\d{14}-[\da-f]{6}$/),
      beforeUrl: before.url,
      afterUrl: after.url,
      options: {
        browsers: ["chromium"],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        element: null,
        fullPage: false,
        waitFor: null,
        waitUntil: "load",
        mask: [],
        threshold: 0.2,
        failAbove: null,
        timeout: 30_000,
      },
      artifactsDir: path.join(real("chromascope-runs"), result.runId),
      comparisons: [
        {
          browser: "chromium",
          pixelChange: expect.any(Number),
          pixelChangePercentage: expect.any(Number),
          before: { width: 1280, height: 720 },
          after: { width: 1280, height: 720 },
          sizeChanged: false,
          beforePath: path.join(result.artifactsDir, "before-chromium.png"),
          afterPath: path.join(result.artifactsDir, "after-chromium.png"),
          diffPath: path.join(result.artifactsDir, "diff-chromium.png"),
        },
      ],
      timings: { totalMs: expect.any(Number), captureMs: { chromium: expect.any(Number) } },
    });
    expect(result.comparisons[0].pixelChange).toBeGreaterThan(0);
    for (const file of ["beforePath", "afterPath", "diffPath"]) {
      expect(fs.existsSync(result.comparisons[0][file])).toBe(true);
    }
    expect(fs.existsSync(real(".chromascope"))).toBe(false);
  });

  it.each([
    [
      ["http://127.0.0.1:1/"],
      "error[MISSING_ARGUMENT]: missing required args for command `versus <before-url> <after-url>`",
    ],
    [["http://127.0.0.1:1/", "not-a-url"], 'error[INVALID_URL]: "not-a-url" is not a valid http(s) URL'],
    [["not-a-url", "http://127.0.0.1:1/"], 'error[INVALID_URL]: "not-a-url" is not a valid http(s) URL'],
    [
      ["http://127.0.0.1:1/", "http://127.0.0.1:2/", "--name", "home"],
      "error[INVALID_OPTION]: Unknown option `--name`",
    ],
    [["http://127.0.0.1:1/", "http://127.0.0.1:2/", "--update"], "error[INVALID_OPTION]: Unknown option `--update`"],
    [["http://127.0.0.1:1/", "http://127.0.0.1:2/", "--clean"], "error[INVALID_OPTION]: Unknown option `--clean`"],
  ])("should exit 2 for versus %j", async (args, message) => {
    const { code, stdout, stderr } = await chromascope("versus", ...args);
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain(message);
    expect(listFiles(tempDir)).toEqual([]);
  });
});
