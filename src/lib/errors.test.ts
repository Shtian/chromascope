import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./error-codes";
import {
  ChromascopeError,
  EXIT_CODES,
  exitCodeFor,
  formatError,
  formatErrorCodes,
  navigationError,
  runtimeError,
  selectorError,
  toChromascopeError,
  toErrorResult,
  usageError,
} from "./errors";

/** Playwright's errors have the name `TimeoutError` when a wait runs out of time. */
const timeoutError = (message: string) => Object.assign(new Error(message), { name: "TimeoutError" });

describe("exitCodeFor", () => {
  it("should exit 2 for usage errors and 3 for runtime errors", () => {
    expect(exitCodeFor(usageError("INVALID_URL", "bad url", "fix it"))).toBe(EXIT_CODES.usage);
    expect(exitCodeFor(runtimeError("NAVIGATION_FAILED", "no page", "start it"))).toBe(EXIT_CODES.runtime);
    expect(EXIT_CODES).toEqual({ ok: 0, aboveFailAbove: 1, usage: 2, runtime: 3 });
  });
});

describe("toChromascopeError", () => {
  it("should return chromascope errors unchanged", () => {
    const error = usageError("INVALID_URL", "Invalid URL", "Pass an http(s) URL");
    expect(toChromascopeError(error)).toBe(error);
  });

  it.each([new Error("boom"), "boom"])("should wrap %j as an unknown runtime error", (thrown) => {
    const error = toChromascopeError(thrown);
    expect(error).toBeInstanceOf(ChromascopeError);
    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.category).toBe("runtime");
    expect(error.message).toBe("boom");
    expect(error.hint).toContain("--verbose");
    expect(error.cause).toBe(thrown);
  });

  it("should keep only the first line of a multi-line message", () => {
    expect(toChromascopeError(new Error("boom\nCall log:\n  - details")).message).toBe("boom");
  });

  it.each([
    ["Unknown option `--nope`", "INVALID_OPTION"],
    ["option `--out <dir>` value is missing", "INVALID_OPTION"],
    ["missing required args for command `diff <url>`", "MISSING_ARGUMENT"],
    ["Unused args: `extra`", "INVALID_ARGUMENT"],
  ])("should map the argument parser error %j to a usage error", (message, code) => {
    const error = toChromascopeError(Object.assign(new Error(message), { name: "CACError" }));
    expect(error).toMatchObject({ code, category: "usage", message });
    expect(error.hint).toContain("--help");
  });
});

describe("navigationError", () => {
  it("should report a timeout and suggest a longer --timeout", () => {
    const error = navigationError(timeoutError("page.goto: Timeout 500ms exceeded.\nCall log:"), "http://x/", 500);
    expect(error).toMatchObject({ code: "NAVIGATION_FAILED", category: "runtime" });
    expect(error.message).toBe("http://x/ did not load within 0.5s");
    expect(error.hint).toContain("--timeout");
  });

  it("should report other failures and suggest checking the server", () => {
    const error = navigationError(
      new Error("page.goto: net::ERR_CONNECTION_REFUSED at http://x/\nCall log:"),
      "http://x/",
      500,
    );
    expect(error.message).toBe("could not load http://x/: page.goto: net::ERR_CONNECTION_REFUSED at http://x/");
    expect(error.hint).toContain("server is running");
  });
});

describe("selectorError", () => {
  it("should report a selector that matched nothing in time", () => {
    const error = selectorError(timeoutError("locator.screenshot: Timeout 30000ms exceeded."), "#nope", 30_000);
    expect(error).toMatchObject({
      code: "SELECTOR_TIMEOUT",
      category: "runtime",
      message: 'no element matched "#nope" within 30s',
      hint: "check the selector, or raise the timeout with --timeout",
    });
  });

  it("should report an invalid selector as a usage error", () => {
    const error = selectorError(
      new Error('locator.screenshot: Unexpected token "" while parsing css selector'),
      "#",
      500,
    );
    expect(error).toMatchObject({ code: "INVALID_SELECTOR", category: "usage" });
  });

  it("should leave other errors to the generic handling", () => {
    const original = new Error("Target page, context or browser has been closed");
    expect(selectorError(original, "#box", 500)).toBe(original);
  });
});

describe("formatError", () => {
  it("should print the code, message and hint", () => {
    expect(formatError(runtimeError("SELECTOR_TIMEOUT", 'no element matched "#nope" within 30s', "check it"))).toEqual([
      'error[SELECTOR_TIMEOUT]: no element matched "#nope" within 30s',
      "hint: check it",
    ]);
  });
});

describe("toErrorResult", () => {
  it("should describe the error in the versioned JSON shape", () => {
    expect(toErrorResult(usageError("INVALID_URL", "Invalid URL", "Pass an http(s) URL"))).toEqual({
      schemaVersion: 1,
      error: { code: "INVALID_URL", message: "Invalid URL", hint: "Pass an http(s) URL" },
    });
  });
});

describe("formatErrorCodes", () => {
  it("should list every code under its exit code, wrapped like the rest of the help", () => {
    expect(formatErrorCodes()).toEqual([
      "  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,",
      "                    INVALID_SELECTOR, CAPTURE_OPTION_CONFLICT",
      "  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, BASELINE_NOT_FOUND,",
      "                    BASELINE_INVALID, UNKNOWN_ERROR",
    ]);
  });

  it("should list each code once", () => {
    const codes = [...ERROR_CODES.usage, ...ERROR_CODES.runtime];
    expect(new Set(codes).size).toBe(codes.length);
  });
});
