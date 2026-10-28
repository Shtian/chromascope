import type { Ora } from "ora";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChromascopeOptions, createChromascopeContext } from "./context";

const options: ChromascopeOptions = {
  verbose: false,
  threshold: 0.2,
  folder: "chromascope-runs",
  saveDiff: false,
  element: "",
  fullPage: false,
  cookie: "",
};
const spinner = {} as Ora;

describe("createChromascopeContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create a run ID from the local date and time", () => {
    vi.setSystemTime(new Date(2026, 9, 28, 14, 5, 9));
    expect(createChromascopeContext(options, spinner).runId).toBe("20261028140509");
  });

  it("should zero-pad single digit months, days and times", () => {
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4, 5));
    expect(createChromascopeContext(options, spinner).runId).toBe("20260102030405");
  });

  it("should put the run folder inside the base folder", () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
    const ctx = createChromascopeContext({ ...options, folder: "out" }, spinner);
    expect(ctx.runFolder).toBe("out/20261231235959");
  });

  it("should keep the options and spinner", () => {
    const ctx = createChromascopeContext(options, spinner);
    expect(ctx.options).toBe(options);
    expect(ctx.spinner).toBe(spinner);
  });
});
