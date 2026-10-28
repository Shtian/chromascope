import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import logger from "./logger";

describe("logger", () => {
  let log: MockInstance<typeof console.log>;
  let error: MockInstance<typeof console.error>;

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logger.setOptions({ verbose: false });
    vi.restoreAllMocks();
  });

  it("should log to stdout and errors to stderr", () => {
    logger.log("hello", 1);
    logger.error("oops");
    expect(log).toHaveBeenCalledWith("hello", 1);
    expect(error).toHaveBeenCalledWith("oops");
  });

  it("should only print debug output when verbose", () => {
    logger.debug("hidden");
    expect(log).not.toHaveBeenCalled();

    logger.setOptions({ verbose: true });
    logger.debug("shown");
    expect(log).toHaveBeenCalledWith("shown");
  });
});
