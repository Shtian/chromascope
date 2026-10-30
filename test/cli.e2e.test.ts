import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { version } from "../package.json";
import {
  closedPortUrl,
  createTempDir,
  FIREFOX_ONLY_CSS,
  type FixtureServer,
  listFiles,
  readPngSize,
  startFixtureServer,
} from "./fixture-server";
import { runCli } from "./run-cli";

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const chromascope = (...args: string[]) => runCli(tempDir, ...args);

/** The version is part of the help output; keep snapshots stable across releases. */
const withoutVersion = (output: string) => output.replaceAll(version, "<version>");

describe("help and version", () => {
  it("should print the help", async () => {
    const { code, stdout } = await chromascope("--help");
    expect(code).toBe(0);
    expect(withoutVersion(stdout)).toMatchSnapshot();
  });

  it("should print the help for diff", async () => {
    const { code, stdout } = await chromascope("diff", "--help");
    expect(code).toBe(0);
    expect(withoutVersion(stdout)).toMatchSnapshot();
  });

  it("should print the help without a command", async () => {
    const [bare, help] = await Promise.all([chromascope(), chromascope("--help")]);
    expect(bare.code).toBe(0);
    expect(bare.stdout).toBe(help.stdout);
  });

  it.each(["snapshot", "compare", "versus", "clean", "doctor"])("should print the help for %s", async (command) => {
    const { code, stdout } = await chromascope(command, "--help");
    expect(code).toBe(0);
    expect(withoutVersion(stdout)).toMatchSnapshot();
  });

  it("should print the version", async () => {
    const { code, stdout } = await chromascope("--version");
    expect(code).toBe(0);
    expect(stdout).toMatch(new RegExp(`^chromascope/${version.replaceAll(".", "\\.")} `));
  });
});

describe("doctor", () => {
  it("should pass every check and print one line per check", async () => {
    const { code, stdout } = await chromascope("doctor");
    expect(code).toBe(0);
    expect(stdout.split("\n").filter(Boolean)).toEqual([
      expect.stringMatching(/^ok node: node \S+, needs >=/),
      "ok chromium: chromium launches",
      "ok webkit: webkit launches",
      "ok firefox: firefox launches",
      `ok folder: ${path.join(fs.realpathSync(tempDir), "chromascope-runs")} is writable`,
    ]);
    expect(listFiles(tempDir)).toEqual([]);
  });

  it("should print the checks as JSON with --json", async () => {
    const { code, stdout, stderr } = await chromascope("doctor", "--json", "--browsers", "chromium");
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      schemaVersion: 1,
      command: "doctor",
      ok: true,
      checks: [
        { name: "node", ok: true, message: expect.any(String), fix: null },
        { name: "chromium", ok: true, message: "chromium launches", fix: null },
        { name: "folder", ok: true, message: expect.stringContaining("is writable"), fix: null },
      ],
    });
  });

  it("should exit 3 with a fix when a check fails", async () => {
    fs.writeFileSync(path.join(tempDir, "file"), "");
    const { code, stdout } = await chromascope("doctor", "--browsers", "chromium", "--folder", "file/runs");
    expect(code).toBe(3);
    expect(stdout).toContain("fail folder: ");
    expect(stdout).toContain("(fix: pass a writable folder with --folder, or fix the folder's permissions)\n");
  });
});

describe("usage errors", () => {
  it.each(["not-a-url", "ftp://chromascope.dev", "https://"])("should reject the invalid url %j", async (url) => {
    const { code, stdout, stderr } = await chromascope("diff", url);
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe(
      `error[INVALID_URL]: ${JSON.stringify(url)} is not a valid http(s) URL\nhint: pass an http(s) URL with a host, like http://localhost:3000\n`,
    );
  });

  it.each([
    [["diff"], "MISSING_ARGUMENT", "missing required args for command `diff <url>`"],
    [["diff", "chromascope.dev", "--nope"], "INVALID_OPTION", "Unknown option `--nope`"],
    [["diff", "chromascope.dev", "--threshold", "2"], "INVALID_OPTION", "--threshold must be a number between 0 and 1"],
    [["diff", "chromascope.dev", "--fail-above", "x"], "INVALID_OPTION", "--fail-above must be a percentage"],
    [["nope"], "UNKNOWN_COMMAND", 'unknown command "nope"'],
  ])("should exit 2 for %j", async (args, errorCode, message) => {
    const { code, stderr } = await chromascope(...args);
    expect(code).toBe(2);
    expect(stderr).toContain(`error[${errorCode}]: ${message}`);
    expect(stderr).toMatch(/\nhint: .+\n$/);
  });

  it("should not write anything for failed runs", async () => {
    await chromascope("diff", "not-a-url");
    expect(listFiles(tempDir)).toEqual([]);
  });
});

describe("runtime errors", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("should exit 3 when the page can't be reached", async () => {
    const url = await closedPortUrl();
    const { code, stdout, stderr } = await chromascope("diff", url, "--browsers", "chromium,webkit");
    expect(code).toBe(3);
    expect(stdout).toBe("");
    expect(stderr).toContain(`error[NAVIGATION_FAILED]: could not load ${url}`);
    expect(stderr).toContain("hint: check the URL and that the server is running");
    expect(stderr).not.toContain("Call log");
  });

  it("should exit 3 when the selector matches nothing within --timeout", async () => {
    const args = ["diff", server.url, "--browsers", "chromium,webkit", "--element", "#nope", "--timeout", "500"];
    const { code, stderr } = await chromascope(...args);
    expect(code).toBe(3);
    expect(stderr).toContain('error[SELECTOR_TIMEOUT]: no element matched "#nope" within 0.5s');
    expect(stderr).toContain("hint: check the selector, or raise the timeout with --timeout");
    expect(stderr).not.toContain("Call log");

    const verbose = await chromascope(...args, "--verbose");
    expect(verbose.stderr).toContain("Call log");
  });

  it("should leave no run folder behind when a capture fails", async () => {
    const closed = await closedPortUrl();
    const failing = [
      ["diff", server.url, "--browsers", "chromium,webkit", "--element", "#nope", "--timeout", "500", "--save-diff"],
      ["versus", server.url, closed, "--browsers", "chromium"],
      ["compare", closed, "--name", "home"],
    ];
    expect((await chromascope("snapshot", server.url, "--name", "home")).code).toBe(0);

    for (const args of failing) {
      const { code } = await chromascope(...args);
      expect(code, args.join(" ")).toBe(3);
    }
    expect(fs.existsSync(path.join(tempDir, "chromascope-runs"))).toBe(false);
  });

  it("should print the error as JSON with --json", async () => {
    const url = await closedPortUrl();
    const { code, stdout } = await chromascope("diff", url, "--browsers", "chromium,webkit", "--json");
    expect(code).toBe(3);
    expect(JSON.parse(stdout)).toEqual({
      schemaVersion: 1,
      error: {
        code: "NAVIGATION_FAILED",
        message: expect.stringContaining(`could not load ${url}`),
        hint: "check the URL and that the server is running",
      },
    });
  });
});

describe("--fail-above", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer();
    server.css = FIREFOX_ONLY_CSS;
  });

  afterAll(async () => {
    await server.close();
  });

  it("should exit 1 when a comparison is above --fail-above", async () => {
    const { code, stdout } = await chromascope(
      "diff",
      server.url,
      "--browsers",
      "chromium,firefox",
      "--fail-above",
      "0",
    );
    expect(code).toBe(1);
    expect(stdout).toMatch(/^firefox \d+\.\d\d% [1-9]\d*px\n$/);
  });

  it("should exit 0 when every comparison is within --fail-above", async () => {
    const { code } = await chromascope("diff", server.url, "--browsers", "chromium,firefox", "--fail-above", "100");
    expect(code).toBe(0);
  });

  it("should exit 0 without --fail-above, whatever the change", async () => {
    const { code } = await chromascope("diff", server.url, "--browsers", "chromium,firefox");
    expect(code).toBe(0);
  });
});

describe("diff", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("should print plain results on stdout and leave no files behind", async () => {
    const { code, stdout } = await chromascope("diff", server.url);
    expect(code).toBe(0);
    expect(stdout).toMatch(/^webkit \d+\.\d\d% \d+px\nfirefox \d+\.\d\d% \d+px\n$/);
    expect(listFiles(tempDir)).toEqual([]);
  });

  it("should print plain progress on stderr", async () => {
    const { stderr } = await chromascope("diff", server.url);
    for (const browser of ["chromium", "webkit", "firefox"]) {
      expect(stderr).toContain(`Capturing ${browser} screenshot\n`);
      expect(stderr).toContain(`Captured ${browser} screenshot\n`);
    }
    expect(stderr).toContain("Diff complete\n");
    expect(stderr).not.toMatch(/[✔✖📷📸🎉]/u);
  });

  it("should print debug output on stderr with --verbose", async () => {
    const { code, stdout, stderr } = await chromascope(
      "diff",
      server.url,
      "--verbose",
      "--browsers",
      "chromium,webkit",
    );
    expect(code).toBe(0);
    expect(stdout).toMatch(/^webkit \d+\.\d\d% \d+px\n$/);
    expect(stderr).toContain("Run ID: ");
  });

  it("should print no progress with --quiet", async () => {
    const { code, stdout, stderr } = await chromascope("diff", server.url, "--quiet", "--browsers", "chromium,webkit");
    expect(code).toBe(0);
    expect(stdout).toMatch(/^webkit \d+\.\d\d% \d+px\n$/);
    expect(stderr).toBe("");
  });

  it("should save the diffs in --folder with --save-diff", async () => {
    const { code, stdout } = await chromascope("diff", server.url, "--save-diff", "--folder", "out");
    expect(code).toBe(0);

    const [runId] = fs.readdirSync(path.join(tempDir, "out"));
    expect(runId).toMatch(/^\d{14}-[\da-f]{6}$/);
    const runFolder = path.join(fs.realpathSync(tempDir), "out", runId);
    expect(stdout).toContain(` ${path.join(runFolder, "diff-chromium-webkit.png")}\n`);
    expect(stdout).toContain(` ${path.join(runFolder, "diff-chromium-firefox.png")}\n`);
    expect(listFiles(runFolder)).toEqual([
      "chromium.png",
      "diff-chromium-firefox.png",
      "diff-chromium-webkit.png",
      "firefox.png",
      "webkit.png",
    ]);
  });

  it("should save the artifacts in exactly the --out folder without --save-diff", async () => {
    const { code, stdout } = await chromascope("diff", server.url, "--out", "artifacts/latest");
    expect(code).toBe(0);

    const outFolder = path.join(fs.realpathSync(tempDir), "artifacts", "latest");
    expect(stdout).toContain(` ${path.join(outFolder, "diff-chromium-webkit.png")}\n`);
    expect(stdout).toContain(` ${path.join(outFolder, "diff-chromium-firefox.png")}\n`);
    expect(listFiles(outFolder)).toEqual([
      "chromium.png",
      "diff-chromium-firefox.png",
      "diff-chromium-webkit.png",
      "firefox.png",
      "webkit.png",
    ]);
    expect(fs.existsSync(path.join(tempDir, "chromascope-runs"))).toBe(false);
  });
});

describe("capture options", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer();
  });

  afterAll(async () => {
    await server.close();
  });

  const out = (file = "") => path.join(tempDir, "out", file);

  it("should capture only --browsers and compare them against --base", async () => {
    const { code, stdout } = await chromascope(
      "diff",
      server.url,
      "--browsers",
      "webkit,firefox",
      "--base",
      "firefox",
      "--out",
      "out",
    );
    expect(code).toBe(0);
    expect(stdout).toMatch(/^webkit \d+\.\d\d% \d+px \S+diff-firefox-webkit\.png\n$/);
    expect(listFiles(out())).toEqual(["diff-firefox-webkit.png", "firefox.png", "webkit.png"]);
  });

  it("should capture at the --viewport size and --device-scale-factor", async () => {
    const { code } = await chromascope(
      "diff",
      server.url,
      "--browsers",
      "chromium,firefox",
      "--viewport",
      "400x300",
      "--device-scale-factor",
      "2",
      "--out",
      "out",
    );
    expect(code).toBe(0);
    expect(readPngSize(out("chromium.png"))).toEqual({ width: 800, height: 600 });
    expect(readPngSize(out("firefox.png"))).toEqual({ width: 800, height: 600 });
  });

  it("should wait for --wait-for before capturing", async () => {
    const { code } = await chromascope(
      "diff",
      `${server.url}#late`,
      "--browsers",
      "chromium,webkit",
      "--wait-for",
      "#late",
      "--wait-until",
      "domcontentloaded",
      "--element",
      "#late",
      "--out",
      "out",
    );
    expect(code).toBe(0);
    expect(readPngSize(out("chromium.png"))).toEqual({ width: 50, height: 40 });
  });

  it("should fail fast on a missing --element with a short --timeout", async () => {
    const started = Date.now();
    const { code, stderr } = await chromascope(
      "diff",
      server.url,
      "--browsers",
      "chromium,firefox",
      "--element",
      "#nope",
      "--timeout",
      "500",
    );
    expect(code).toBe(3);
    expect(stderr).toContain("#nope");
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  it.each([
    [["--browsers", "chrome"], "--browsers must be a comma separated list"],
    [["--browsers", "chromium"], "diff needs at least one browser besides the base"],
    [["--viewport", "big"], "--viewport must be <width>x<height>"],
    [["--wait-until", "idle"], "--wait-until must be one of load, domcontentloaded, networkidle"],
  ])("should reject %j", async (args, message) => {
    const { code, stderr } = await chromascope("diff", server.url, ...args);
    expect(code).toBe(2);
    expect(stderr).toContain(`error[INVALID_OPTION]: ${message}`);
  });
});

/** Checks that a `--json` result of `diff` has every documented field with the documented type. */
const expectDiffResultSchema = (result: Record<string, unknown>) => {
  expect(result).toEqual({
    schemaVersion: 1,
    command: "diff",
    runId: expect.stringMatching(/^\d{14}-[\da-f]{6}$/),
    url: expect.any(String),
    base: expect.any(String),
    options: {
      browsers: expect.any(Array),
      element: expect.toBeOneOf([null, expect.any(String)]),
      fullPage: expect.any(Boolean),
      threshold: expect.any(Number),
      failAbove: expect.toBeOneOf([null, expect.any(Number)]),
      viewport: { width: expect.any(Number), height: expect.any(Number) },
      deviceScaleFactor: expect.any(Number),
      timeout: expect.any(Number),
      waitFor: expect.toBeOneOf([null, expect.any(String)]),
      waitUntil: expect.any(String),
      mask: expect.any(Array),
    },
    artifactsDir: expect.toBeOneOf([null, expect.any(String)]),
    screenshots: expect.any(Object),
    comparisons: expect.any(Array),
    timings: { totalMs: expect.any(Number), captureMs: expect.any(Object) },
  });
  for (const comparison of result.comparisons as unknown[]) {
    expect(comparison).toEqual({
      browser: expect.any(String),
      pixelChange: expect.any(Number),
      pixelChangePercentage: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
      diffPath: expect.toBeOneOf([null, expect.any(String)]),
    });
  }
};

describe("--json", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("should print one JSON document with the result and no progress", async () => {
    const { code, stdout, stderr } = await chromascope("diff", server.url, "--json", "--browsers", "chromium,webkit");
    expect(code).toBe(0);
    expect(stderr).toBe("");

    const result = JSON.parse(stdout);
    expectDiffResultSchema(result);
    expect(result).toMatchObject({
      url: server.url,
      base: "chromium",
      options: { browsers: ["chromium", "webkit"], element: null, viewport: { width: 1280, height: 720 } },
      artifactsDir: null,
      screenshots: { chromium: null, webkit: null },
      comparisons: [{ browser: "webkit", width: 1280, height: 720, diffPath: null }],
      timings: { captureMs: { chromium: expect.any(Number), webkit: expect.any(Number) } },
    });
  });

  it("should list absolute paths that exist when the artifacts are saved", async () => {
    const { code, stdout } = await chromascope("diff", server.url, "--json", "--out", "out", "--element", "#box");
    expect(code).toBe(0);

    const result = JSON.parse(stdout);
    expectDiffResultSchema(result);
    const outFolder = path.join(fs.realpathSync(tempDir), "out");
    expect(result.artifactsDir).toBe(outFolder);
    expect(result.options.element).toBe("#box");
    const paths = [
      ...Object.values(result.screenshots),
      ...result.comparisons.map((comparison: { diffPath: string }) => comparison.diffPath),
    ] as string[];
    expect(paths).toHaveLength(5);
    for (const file of paths) {
      expect(path.isAbsolute(file)).toBe(true);
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it("should print a JSON error object when the run fails", async () => {
    const { code, stdout, stderr } = await chromascope("diff", "not-a-url", "--json");
    expect(code).toBe(2);
    expect(JSON.parse(stdout)).toEqual({
      schemaVersion: 1,
      error: { code: expect.any(String), message: expect.any(String), hint: expect.any(String) },
    });
    expect(stderr).not.toBe("");
  });
});
