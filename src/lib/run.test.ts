import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRunId, openRun } from "./run";

describe("createRunId", () => {
  it("should start with the local date and time", () => {
    expect(createRunId(new Date(2026, 9, 28, 14, 5, 9))).toMatch(/^20261028140509-[\da-f]{6}$/);
  });

  it("should zero-pad single digit months, days and times", () => {
    expect(createRunId(new Date(2026, 0, 2, 3, 4, 5))).toMatch(/^20260102030405-[\da-f]{6}$/);
  });

  it("should be unique for runs started in the same second", () => {
    const now = new Date(2026, 9, 28, 16, 3, 12);
    // The suffix has 24 random bits, so 1000 IDs collide in ~3% of runs; 20 keeps it near one in 100,000.
    const ids = Array.from({ length: 20 }, () => createRunId(now));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("openRun", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should put the run folder inside --folder, named after the run ID", () => {
    const { runId, dir } = openRun({ folder: "runs" });
    expect(runId).toMatch(/^\d{14}-[\da-f]{6}$/);
    expect(dir).toBe(path.resolve("runs", runId));
  });

  it("should use --out as the run folder, as an absolute path", () => {
    expect(openRun({ folder: "runs", out: "artifacts" }).dir).toBe(path.resolve("artifacts"));
  });

  it("should give every run its own ID", () => {
    expect(openRun({ folder: "runs" }).runId).not.toBe(openRun({ folder: "runs" }).runId);
  });

  it("should create nothing until the first artifact is written", () => {
    const run = openRun({ folder: path.join(tempDir, "runs") });
    expect(run.pathOf("chromium.png")).toBe(path.join(run.dir, "chromium.png"));
    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  it("should create the run folder and the base folder on the first write, and return absolute paths", () => {
    const run = openRun({ folder: path.join(tempDir, "runs") });

    const first = run.write("chromium.png", Buffer.from("a"));
    const second = run.write("webkit.png", Buffer.from("b"));

    expect(first).toBe(path.join(tempDir, "runs", run.runId, "chromium.png"));
    expect(path.isAbsolute(second)).toBe(true);
    expect(fs.readFileSync(first, "utf8")).toBe("a");
    expect(fs.readdirSync(run.dir).sort()).toEqual(["chromium.png", "webkit.png"]);
  });

  it("should fail when the run folder already exists", () => {
    const run = openRun({ folder: tempDir });
    fs.mkdirSync(run.dir);

    expect(() => run.write("chromium.png", Buffer.from(""))).toThrow("EEXIST");
  });

  it("should create the --out folder", () => {
    const out = path.join(tempDir, "a", "b");

    openRun({ folder: "runs", out }).write("chromium.png", Buffer.from(""));

    expect(fs.readdirSync(out)).toEqual(["chromium.png"]);
  });

  it("should reuse an existing --out folder", () => {
    fs.writeFileSync(path.join(tempDir, "chromium.png"), "");

    expect(() => openRun({ folder: "runs", out: tempDir }).write("webkit.png", Buffer.from(""))).not.toThrow();
    expect(fs.readdirSync(tempDir).sort()).toEqual(["chromium.png", "webkit.png"]);
  });
});
