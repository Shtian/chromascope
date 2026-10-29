import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BrowserType } from "playwright";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkBrowser, checkFolder, checkNode, isAtLeast, runDoctor } from "./doctor";

const fakeBrowserType = (name: string, launch: () => Promise<unknown> = async () => ({ close: async () => {} })) =>
  ({ name: () => name, launch }) as unknown as BrowserType;

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-doctor-"));
});

afterEach(() => {
  fs.chmodSync(tempDir, 0o755);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("isAtLeast", () => {
  it.each([
    ["22.12.0", ">=22.12", true],
    ["22.12.1", "22.12", true],
    ["24.0.0", ">=22.12", true],
    ["v23.1.0", ">=22.12", true],
    ["22.11.9", ">=22.12", false],
    ["20.19.0", ">=22.12", false],
    ["24.0.0", ">=24", true],
    ["23.11.0", ">=24", false],
  ])("should compare %s against %s", (version, minimum, expected) => {
    expect(isAtLeast(version, minimum)).toBe(expected);
  });
});

describe("checkNode", () => {
  it("should pass for a supported Node version", () => {
    expect(checkNode("24.0.0", ">=24")).toEqual({
      name: "node",
      ok: true,
      message: "node 24.0.0, needs >=24",
      fix: null,
    });
  });

  it("should fail with the version to install for an older Node", () => {
    expect(checkNode("22.12.0", ">=24")).toEqual({
      name: "node",
      ok: false,
      message: "node 22.12.0, needs >=24",
      fix: "install Node 24 or later",
    });
  });

  it("should check the running Node against package.json by default", () => {
    expect(checkNode().ok).toBe(true);
  });
});

describe("checkBrowser", () => {
  it("should pass when the browser launches", async () => {
    expect(await checkBrowser(fakeBrowserType("webkit"))).toEqual({
      name: "webkit",
      ok: true,
      message: "webkit launches",
      fix: null,
    });
  });

  it("should point to `chromascope install` when the browser isn't installed", async () => {
    const browserType = fakeBrowserType("firefox", async () => {
      throw new Error("browserType.launch: Executable doesn't exist at /tmp/firefox");
    });
    expect(await checkBrowser(browserType)).toEqual({
      name: "firefox",
      ok: false,
      message: "firefox is not installed",
      fix: "run `chromascope install` to install the browsers",
    });
  });

  it("should point to the system libraries when the browser fails to launch", async () => {
    const browserType = fakeBrowserType("chromium", async () => {
      throw new Error("browserType.launch: Host system is missing dependencies\nlibnss3.so");
    });
    expect(await checkBrowser(browserType)).toEqual({
      name: "chromium",
      ok: false,
      message: "chromium doesn't launch: browserType.launch: Host system is missing dependencies",
      fix: "install the system libraries it needs with `npx playwright install-deps`",
    });
  });

  it("should fail for anything thrown that isn't an error", async () => {
    const browserType = fakeBrowserType("chromium", () => Promise.reject("crashed"));
    expect(await checkBrowser(browserType)).toMatchObject({ ok: false, message: "chromium doesn't launch: crashed" });
  });
});

describe("checkFolder", () => {
  it("should pass for an existing writable folder", () => {
    expect(checkFolder(tempDir)).toEqual({ name: "folder", ok: true, message: `${tempDir} is writable`, fix: null });
  });

  it("should pass for a missing folder inside a writable one, without creating it", () => {
    const folder = path.join(tempDir, "runs", "nested");
    expect(checkFolder(folder)).toMatchObject({ ok: true, message: `${folder} is writable` });
    expect(fs.existsSync(path.join(tempDir, "runs"))).toBe(false);
  });

  it("should resolve a relative folder to an absolute path", () => {
    expect(checkFolder("chromascope-runs").message).toBe(`${path.resolve("chromascope-runs")} is writable`);
  });

  it("should fail when a file is in the way", () => {
    const file = path.join(tempDir, "file");
    fs.writeFileSync(file, "");
    expect(checkFolder(path.join(file, "runs"))).toEqual({
      name: "folder",
      ok: false,
      message: `${path.join(file, "runs")} can't be created: ${file} is not a folder`,
      fix: "pass a writable folder with --folder, or fix the folder's permissions",
    });
  });

  it.skipIf(process.getuid?.() === 0)("should fail for a folder without write access", () => {
    fs.chmodSync(tempDir, 0o555);
    expect(checkFolder(path.join(tempDir, "runs"))).toMatchObject({
      ok: false,
      message: `${path.join(tempDir, "runs")} is not writable: no write access to ${tempDir}`,
    });
  });
});

describe("runDoctor", () => {
  it("should run every check and pass when all pass", async () => {
    const result = await runDoctor({ browserTypes: [fakeBrowserType("chromium")], folder: tempDir });
    expect(result).toMatchObject({ schemaVersion: 1, command: "doctor", ok: true });
    expect(result.checks.map((check) => check.name)).toEqual(["node", "chromium", "folder"]);
  });

  it("should fail when any check fails", async () => {
    const missing = fakeBrowserType("webkit", async () => {
      throw new Error("Executable doesn't exist");
    });
    const result = await runDoctor({ browserTypes: [fakeBrowserType("chromium"), missing], folder: tempDir });
    expect(result.ok).toBe(false);
    expect(result.checks.filter((check) => !check.ok).map((check) => check.name)).toEqual(["webkit"]);
  });
});
