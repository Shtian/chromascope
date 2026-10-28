import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  BOX_SIZE,
  createTempDir,
  FIREFOX_ONLY_CSS,
  type FixtureServer,
  listFiles,
  PAGE_HEIGHT,
  startFixtureServer,
} from "./fixture-server";
import { runCli } from "./run-cli";

/** Changes the colour of `#box`, the element the tests capture with `--element`. */
const BOX_CHANGE = "#box { background: #0c0; }";
/** Changes the colour of `#tall`, below `#box` but still inside the viewport. */
const OUTSIDE_BOX_CHANGE = "#tall { background: #0c0; }";

let server: FixtureServer;
let tempDir: string;
/** The baseline name derived from the fixture URL, like `127-0-0-1-53412`. */
let derivedName: string;

beforeAll(async () => {
  server = await startFixtureServer();
  derivedName = `127-0-0-1-${new URL(server.url).port}`;
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  tempDir = createTempDir();
  server.css = "";
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const chromascope = (...args: string[]) => runCli(tempDir, ...args);
const real = (...segments: string[]) => path.join(fs.realpathSync(tempDir), ...segments);
const baselines = (...segments: string[]) => real(".chromascope", "baselines", ...segments);
const json = async (...args: string[]) => {
  const run = await chromascope(...args, "--json");
  return { ...run, result: JSON.parse(run.stdout) };
};

describe("snapshot", () => {
  it("should store a chromium baseline under the derived name and ignore .chromascope in git", async () => {
    const { code, stdout } = await chromascope("snapshot", server.url);
    expect(code).toBe(0);
    expect(stdout).toBe(`chromium ${baselines(derivedName, "chromium.png")}\n`);
    expect(listFiles(real(".chromascope"))).toEqual([
      ".gitignore",
      "baselines",
      `baselines/${derivedName}`,
      `baselines/${derivedName}/chromium.png`,
      `baselines/${derivedName}/metadata.json`,
    ]);
    expect(fs.readFileSync(real(".chromascope", ".gitignore"), "utf8")).toBe("*\n");

    const metadata = JSON.parse(fs.readFileSync(baselines(derivedName, "metadata.json"), "utf8"));
    expect(metadata).toEqual({
      url: server.url,
      browsers: ["chromium"],
      capture: {
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        element: null,
        fullPage: false,
        waitFor: null,
        waitUntil: "load",
        mask: [],
      },
      capturedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      chromascopeVersion: expect.any(String),
    });
  });

  it("should derive the name from the element too, and accept --name", async () => {
    await chromascope("snapshot", server.url, "--element", "#box");
    await chromascope("snapshot", server.url, "--name", "home");
    expect(fs.readdirSync(baselines()).sort()).toEqual([`${derivedName}__box`, "home"]);
  });

  it("should replace an existing baseline with the same name", async () => {
    await chromascope("snapshot", server.url, "--browsers", "chromium,firefox");
    await chromascope("snapshot", server.url, "--browsers", "webkit");
    expect(listFiles(baselines(derivedName))).toEqual(["metadata.json", "webkit.png"]);
  });
});

describe("compare", () => {
  it("should report no change for an unchanged page", async () => {
    await chromascope("snapshot", server.url, "--browsers", "chromium,firefox");
    const { code, stdout } = await chromascope("compare", server.url);
    expect(code).toBe(0);
    expect(stdout).toMatch(/^chromium 0\.00% 0px 1280x720->1280x720 \S+\nfirefox 0\.00% 0px 1280x720->1280x720 \S+\n$/);
  });

  it("should exit 1 above --fail-above and keep the before, after and diff images", async () => {
    await chromascope("snapshot", server.url);
    server.css = BOX_CHANGE;
    const { code, stdout } = await chromascope("compare", server.url, "--fail-above", "0");
    expect(code).toBe(1);
    expect(stdout).toMatch(/^chromium \d+\.\d\d% [1-9]\d*px /);

    const [runId] = fs.readdirSync(real("chromascope-runs"));
    expect(listFiles(real("chromascope-runs", runId))).toEqual([
      "after-chromium.png",
      "before-chromium.png",
      "diff-chromium.png",
    ]);
  });

  it("should write the images to exactly --out", async () => {
    await chromascope("snapshot", server.url);
    const { code } = await chromascope("compare", server.url, "--out", "out");
    expect(code).toBe(0);
    expect(listFiles(real("out"))).toEqual(["after-chromium.png", "before-chromium.png", "diff-chromium.png"]);
  });

  it("should keep a change outside --element out of the comparison", async () => {
    await chromascope("snapshot", server.url, "--element", "#box");
    await chromascope("snapshot", server.url);
    server.css = OUTSIDE_BOX_CHANGE;

    const element = await json("compare", server.url, "--element", "#box");
    expect(element.code).toBe(0);
    expect(element.result.comparisons[0]).toMatchObject({ pixelChange: 0, before: BOX_SIZE, after: BOX_SIZE });

    const page = await json("compare", server.url);
    expect(page.result.comparisons[0].pixelChange).toBeGreaterThan(0);
  });

  it("should compare the captures of the URL stored with --name", async () => {
    await chromascope("snapshot", server.url, "--name", "home");
    const { code, result } = await json("compare", "--name", "home");
    expect(code).toBe(0);
    expect(result.url).toBe(server.url);
  });

  it("should exit 3 with the snapshot command to run when there is no baseline", async () => {
    const { code, stdout, stderr } = await chromascope("compare", server.url, "--element", "#box");
    expect(code).toBe(3);
    expect(stdout).toBe("");
    expect(stderr).toContain(`error[BASELINE_NOT_FOUND]: no baseline named "${derivedName}__box"`);
    expect(stderr).toContain(`hint: capture one first: chromascope snapshot ${server.url} --element '#box'\n`);
    expect(fs.existsSync(real(".chromascope"))).toBe(false);
  });

  it("should exit 2 naming the capture option that differs from the baseline", async () => {
    await chromascope("snapshot", server.url);
    const { code, stderr } = await chromascope("compare", server.url, "--viewport", "800x600", "--full-page");
    expect(code).toBe(2);
    expect(stderr).toContain(
      "error[CAPTURE_OPTION_CONFLICT]: --viewport 800x600 differs from the baseline's 1280x720; --full-page on differs from the baseline's off",
    );
    expect(stderr).toMatch(/hint: .*chromascope snapshot.*compare --update/);
  });

  it("should reuse the baseline's capture options and accept the same values", async () => {
    await chromascope("snapshot", server.url, "--viewport", "400x300", "--device-scale-factor", "2");
    const { code, result } = await json("compare", server.url, "--viewport", "400x300");
    expect(code).toBe(0);
    expect(result.options).toMatchObject({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 2 });
    expect(result.comparisons[0].after).toEqual({ width: 800, height: 600 });
  });

  it("should compare every browser of the baseline, and fail for a browser without one", async () => {
    await chromascope("snapshot", server.url, "--browsers", "chromium,firefox");

    const all = await json("compare", server.url);
    expect(all.code).toBe(0);
    expect(all.result.comparisons.map((c: { browser: string }) => c.browser)).toEqual(["chromium", "firefox"]);

    const { code, stderr } = await chromascope("compare", server.url, "--browsers", "webkit");
    expect(code).toBe(3);
    expect(stderr).toContain(`error[BASELINE_NOT_FOUND]: baseline "${derivedName}" has no webkit capture`);
    expect(stderr).toContain(`chromascope snapshot ${server.url} --browsers chromium,firefox,webkit`);
  });

  it("should accept the new capture with --update, even above --fail-above", async () => {
    await chromascope("snapshot", server.url);
    server.css = BOX_CHANGE;

    const update = await json("compare", server.url, "--fail-above", "0", "--update");
    expect(update.code).toBe(0);
    expect(update.result.updated).toBe(true);
    expect(update.result.comparisons[0].pixelChange).toBeGreaterThan(0);

    const next = await json("compare", server.url, "--fail-above", "0");
    expect(next.code).toBe(0);
    expect(next.result.comparisons[0].pixelChange).toBe(0);
  });

  it("should accept new capture options with --update, and drop browsers captured with the old ones", async () => {
    await chromascope("snapshot", server.url, "--browsers", "chromium,firefox");

    const update = await json("compare", server.url, "--browsers", "chromium", "--viewport", "400x300", "--update");
    expect(update.code).toBe(0);

    const metadata = JSON.parse(fs.readFileSync(baselines(derivedName, "metadata.json"), "utf8"));
    expect(metadata.browsers).toEqual(["chromium"]);
    expect(metadata.capture.viewport).toEqual({ width: 400, height: 300 });
    expect(listFiles(baselines(derivedName))).toEqual(["chromium.png", "metadata.json"]);

    const next = await json("compare", server.url);
    expect(next.code).toBe(0);
    expect(next.result.comparisons[0]).toMatchObject({ pixelChange: 0, after: { width: 400, height: 300 } });
  });

  it("should delete the baseline with --clean only when the comparison exits 0", async () => {
    await chromascope("snapshot", server.url);
    server.css = BOX_CHANGE;

    const failed = await json("compare", server.url, "--fail-above", "0", "--clean");
    expect(failed.code).toBe(1);
    expect(failed.result.cleaned).toBe(false);
    expect(fs.existsSync(baselines(derivedName))).toBe(true);

    const passed = await json("compare", server.url, "--fail-above", "100", "--clean");
    expect(passed.code).toBe(0);
    expect(passed.result.cleaned).toBe(true);
    expect(fs.existsSync(baselines(derivedName))).toBe(false);
    expect(fs.readdirSync(real("chromascope-runs"))).toHaveLength(2);
  });

  it("should print one JSON document with sizes and absolute image paths", async () => {
    await chromascope("snapshot", server.url, "--full-page");
    server.css = "#tall { height: 3500px; }";

    const { code, stdout, stderr, result } = await json("compare", server.url);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.trim().startsWith("{")).toBe(true);
    expect(result).toEqual({
      schemaVersion: 1,
      command: "compare",
      runId: expect.stringMatching(/^\d{14}-[\da-f]{6}$/),
      name: derivedName,
      baselineDir: baselines(derivedName),
      url: server.url,
      options: {
        browsers: ["chromium"],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        element: null,
        fullPage: true,
        waitFor: null,
        waitUntil: "load",
        mask: [],
        threshold: 0.2,
        failAbove: null,
        timeout: 30_000,
      },
      artifactsDir: expect.stringContaining(real("chromascope-runs")),
      comparisons: [
        {
          browser: "chromium",
          pixelChange: expect.any(Number),
          pixelChangePercentage: expect.any(Number),
          before: { width: 1280, height: PAGE_HEIGHT },
          after: { width: 1280, height: PAGE_HEIGHT + 500 },
          sizeChanged: true,
          beforePath: path.join(result.artifactsDir, "before-chromium.png"),
          afterPath: path.join(result.artifactsDir, "after-chromium.png"),
          diffPath: path.join(result.artifactsDir, "diff-chromium.png"),
        },
      ],
      updated: false,
      cleaned: false,
      timings: { totalMs: expect.any(Number), captureMs: { chromium: expect.any(Number) } },
    });
    expect(result.comparisons[0].pixelChange).toBeGreaterThan(0);
    for (const file of ["beforePath", "afterPath", "diffPath"]) {
      expect(fs.existsSync(result.comparisons[0][file])).toBe(true);
    }
  });

  it.each([
    [[], "error[MISSING_ARGUMENT]: compare needs a URL or --name"],
    [["--name", "home", "--update", "--clean"], "error[INVALID_OPTION]: --update and --clean can't be used together"],
    [["--name", "../home"], "error[INVALID_OPTION]: --name must be"],
  ])("should exit 2 for compare %j", async (args, message) => {
    const { code, stderr } = await chromascope("compare", ...args);
    expect(code).toBe(2);
    expect(stderr).toContain(message);
  });
});

describe("clean", () => {
  it("should delete one name, or every baseline, and leave run folders alone", async () => {
    await chromascope("snapshot", server.url, "--name", "home");
    await chromascope("snapshot", server.url, "--name", "about");
    await chromascope("compare", "--name", "home");

    const one = await chromascope("clean", "home");
    expect(one.code).toBe(0);
    expect(one.stdout).toBe(`${baselines("home")}\n`);
    expect(fs.readdirSync(baselines())).toEqual(["about"]);

    const all = await chromascope("clean");
    expect(all.code).toBe(0);
    expect(fs.existsSync(baselines())).toBe(false);
    expect(fs.readdirSync(real("chromascope-runs"))).toHaveLength(1);
  });

  it("should not fail when there is nothing to delete", async () => {
    expect(await chromascope("clean", "home")).toMatchObject({ code: 0, stdout: "" });
    expect(await chromascope("clean")).toMatchObject({ code: 0, stdout: "" });
  });
});

describe("--baseline-dir", () => {
  it("should store, compare and clean baselines in the given folder", async () => {
    await chromascope("snapshot", server.url, "--baseline-dir", "shots");
    expect(listFiles(real("shots"))).toEqual([
      derivedName,
      `${derivedName}/chromium.png`,
      `${derivedName}/metadata.json`,
    ]);
    expect(fs.existsSync(real(".chromascope"))).toBe(false);

    expect((await chromascope("compare", server.url)).code).toBe(3);
    expect((await chromascope("compare", server.url, "--baseline-dir", "shots")).code).toBe(0);

    await chromascope("clean", "--baseline-dir", "shots");
    expect(fs.existsSync(real("shots"))).toBe(false);
  });
});

describe("--mask", () => {
  it("should hide a change inside the masked element from compare", async () => {
    await chromascope("snapshot", server.url, "--mask", "#box");
    server.css = BOX_CHANGE;
    const { code, result } = await json("compare", server.url, "--fail-above", "0");
    expect(code).toBe(0);
    expect(result.options.mask).toEqual(["#box"]);
    expect(result.comparisons[0].pixelChange).toBe(0);
  });

  it("should hide a difference inside the masked element from diff", async () => {
    server.css = FIREFOX_ONLY_CSS;
    const args = ["diff", server.url, "--browsers", "chromium,firefox", "--fail-above", "0"];

    const unmasked = await chromascope(...args);
    expect(unmasked.code).toBe(1);

    const masked = await json(...args, "--mask", "#box");
    expect(masked.code).toBe(0);
    expect(masked.result.comparisons[0].pixelChange).toBe(0);
  });
});
