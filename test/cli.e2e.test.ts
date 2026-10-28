import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { version } from "../package.json";
import { createTempDir, type FixtureServer, listFiles, readPngSize, startFixtureServer } from "./fixture-server";

const BIN = path.join(import.meta.dirname, "../dist/index.js");

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/** Runs the built CLI from a temp directory, so runs never write to the repo. */
const chromascope = (...args: string[]) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: tempDir,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });

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

  it("should print the version", async () => {
    const { code, stdout } = await chromascope("--version");
    expect(code).toBe(0);
    expect(stdout).toMatch(new RegExp(`^chromascope/${version.replaceAll(".", "\\.")} `));
  });
});

describe("errors", () => {
  it.each(["not-a-url", "ftp://chromascope.dev", "https://"])("should reject the invalid url %j", async (url) => {
    const { code, stderr } = await chromascope("diff", url);
    expect(code).toBe(1);
    expect(stderr).toContain("Please provide a valid url");
  });

  it("should fail when the url is missing", async () => {
    const { code, stderr } = await chromascope("diff");
    expect(code).toBe(1);
    expect(stderr).toContain("missing required args for command `diff <url>`");
  });

  it("should reject an out of range threshold", async () => {
    const { code, stderr } = await chromascope("diff", "chromascope.dev", "--threshold", "2");
    expect(code).toBe(1);
    expect(stderr).toContain("--threshold must be a number between 0 and 1, got 2");
  });

  it("should not write anything for failed runs", async () => {
    await chromascope("diff", "not-a-url");
    expect(listFiles(tempDir)).toEqual([]);
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
      server.url,
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
    expect(code).not.toBe(0);
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
    expect(code).not.toBe(0);
    expect(stderr).toContain(message);
  });
});
