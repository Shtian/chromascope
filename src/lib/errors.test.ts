import { describe, expect, it } from "vitest";
import { ChromascopeError, toChromascopeError, toErrorResult } from "./errors";

describe("toChromascopeError", () => {
  it("should return chromascope errors unchanged", () => {
    const error = new ChromascopeError("INVALID_URL", "Invalid URL", "Pass an http(s) URL");
    expect(toChromascopeError(error)).toBe(error);
  });

  it.each([new Error("boom"), "boom"])("should wrap %j as an unknown error", (thrown) => {
    const error = toChromascopeError(thrown);
    expect(error).toBeInstanceOf(ChromascopeError);
    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.message).toBe("boom");
    expect(error.hint).toContain("--verbose");
    expect(error.cause).toBe(thrown);
  });
});

describe("toErrorResult", () => {
  it("should describe the error in the versioned JSON shape", () => {
    expect(toErrorResult(new ChromascopeError("INVALID_URL", "Invalid URL", "Pass an http(s) URL"))).toEqual({
      schemaVersion: 1,
      error: { code: "INVALID_URL", message: "Invalid URL", hint: "Pass an http(s) URL" },
    });
  });
});
