import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChromascopeOptions, createChromascopeContext, createRunId, resolveRun } from "./context";
import { parseCaptureOptions } from "./lib/capture-options";

const options: ChromascopeOptions = {
  ...parseCaptureOptions({}, { browsers: ["chromium", "webkit"] }),
  base: "chromium",
  verbose: false,
  threshold: 0.2,
  failAbove: null,
  folder: "chromascope-runs",
  saveDiff: false,
};

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

describe("resolveRun", () => {
  it("should put the run folder inside --folder, named after the run ID", () => {
    const { runId, runFolder } = resolveRun({ folder: "runs" });
    expect(runFolder).toBe(path.resolve("runs", runId));
  });

  it("should use --out as the run folder, as an absolute path", () => {
    expect(resolveRun({ folder: "runs", out: "artifacts" }).runFolder).toBe(path.resolve("artifacts"));
  });

  it("should give every run its own ID", () => {
    expect(resolveRun({ folder: "runs" }).runId).not.toBe(resolveRun({ folder: "runs" }).runId);
  });
});

describe("createChromascopeContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should put the run folder inside the base folder as an absolute path", () => {
    const ctx = createChromascopeContext({ ...options, folder: "out" });
    expect(ctx.runId).toMatch(/^20261231235959-[\da-f]{6}$/);
    expect(ctx.runFolder).toBe(path.resolve("out", ctx.runId));
  });

  it("should use --out as the run folder", () => {
    expect(createChromascopeContext({ ...options, out: "artifacts" }).runFolder).toBe(path.resolve("artifacts"));
  });

  it.each([
    [{}, false],
    [{ saveDiff: true }, true],
    [{ out: "artifacts" }, true],
    [{ saveDiff: true, out: "artifacts" }, true],
  ])("should save artifacts for %j: %j", (overrides, expected) => {
    expect(createChromascopeContext({ ...options, ...overrides }).saveArtifacts).toBe(expected);
  });

  it("should keep the options", () => {
    const ctx = createChromascopeContext(options);
    expect(ctx.options).toBe(options);
  });
});
