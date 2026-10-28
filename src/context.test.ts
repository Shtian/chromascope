import path from "node:path";
import type { Ora } from "ora";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChromascopeOptions, createChromascopeContext, createRunId } from "./context";
import { parseCaptureOptions } from "./lib/capture-options";

const options: ChromascopeOptions = {
  ...parseCaptureOptions({}, { browsers: ["chromium", "webkit"] }),
  base: "chromium",
  verbose: false,
  threshold: 0.2,
  folder: "chromascope-runs",
  saveDiff: false,
};
const spinner = {} as Ora;

describe("createRunId", () => {
  it("should start with the local date and time", () => {
    expect(createRunId(new Date(2026, 9, 28, 14, 5, 9))).toMatch(/^20261028140509-[\da-f]{6}$/);
  });

  it("should zero-pad single digit months, days and times", () => {
    expect(createRunId(new Date(2026, 0, 2, 3, 4, 5))).toMatch(/^20260102030405-[\da-f]{6}$/);
  });

  it("should be unique for runs started in the same second", () => {
    const now = new Date(2026, 9, 28, 16, 3, 12);
    const ids = Array.from({ length: 1000 }, () => createRunId(now));
    expect(new Set(ids).size).toBe(ids.length);
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
    const ctx = createChromascopeContext({ ...options, folder: "out" }, spinner);
    expect(ctx.runId).toMatch(/^20261231235959-[\da-f]{6}$/);
    expect(ctx.runFolder).toBe(path.resolve("out", ctx.runId));
  });

  it("should use --out as the run folder", () => {
    expect(createChromascopeContext({ ...options, out: "artifacts" }, spinner).runFolder).toBe(
      path.resolve("artifacts"),
    );
  });

  it.each([
    [{}, false],
    [{ saveDiff: true }, true],
    [{ out: "artifacts" }, true],
    [{ saveDiff: true, out: "artifacts" }, true],
  ])("should save artifacts for %j: %j", (overrides, expected) => {
    expect(createChromascopeContext({ ...options, ...overrides }, spinner).saveArtifacts).toBe(expected);
  });

  it("should keep the options and spinner", () => {
    const ctx = createChromascopeContext(options, spinner);
    expect(ctx.options).toBe(options);
    expect(ctx.spinner).toBe(spinner);
  });
});
