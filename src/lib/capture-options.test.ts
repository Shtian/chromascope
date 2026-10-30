import { describe, expect, it } from "vitest";
import { parseBase, parseBrowsers, parseCaptureOptions, parseTimeout } from "./capture-options";

describe("parseBrowsers", () => {
  it.each([
    ["chromium", ["chromium"]],
    ["chromium,webkit,firefox", ["chromium", "webkit", "firefox"]],
    [" firefox , WebKit ", ["firefox", "webkit"]],
    ["firefox,firefox", ["firefox"]],
    [
      ["chromium", "firefox"],
      ["chromium", "firefox"],
    ],
  ])("should parse %j", (value, expected) => {
    expect(parseBrowsers(value)).toEqual(expected);
  });

  it.each(["", ",", "chrome", "chromium,edge", 1, true])("should reject %j", (value) => {
    expect(() => parseBrowsers(value)).toThrow(
      "--browsers must be a comma separated list of chromium, webkit, firefox",
    );
  });
});

describe("parseBase", () => {
  it("should put the base browser first and add it when it isn't listed", () => {
    expect(parseBase("chromium", ["webkit", "chromium", "firefox"])).toEqual({
      base: "chromium",
      browsers: ["chromium", "webkit", "firefox"],
    });
    expect(parseBase("firefox", ["chromium"])).toEqual({ base: "firefox", browsers: ["firefox", "chromium"] });
  });

  it("should reject an unknown browser", () => {
    expect(() => parseBase("chrome", ["chromium", "webkit"])).toThrow(
      "--base must be one of chromium, webkit, firefox",
    );
  });

  it("should reject a run with nothing to compare", () => {
    expect(() => parseBase("chromium", ["chromium"])).toThrow("diff needs at least one browser besides the base");
  });
});

describe("parseTimeout", () => {
  it.each([0, 500, "30000"])("should accept %j", (value) => {
    expect(parseTimeout(value)).toBe(Number(value));
  });

  it.each([-1, 1.5, "", "abc", true])("should reject %j", (value) => {
    expect(() => parseTimeout(value)).toThrow("--timeout must be a whole number of milliseconds");
  });
});

describe("parseCaptureOptions", () => {
  it("should fill in the defaults", () => {
    expect(parseCaptureOptions({}, { browsers: ["chromium"] })).toEqual({
      browsers: ["chromium"],
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      element: null,
      fullPage: false,
      waitFor: null,
      waitUntil: "load",
      mask: [],
      timeout: 30_000,
      cookie: "",
    });
  });

  it("should use the options that were given", () => {
    expect(
      parseCaptureOptions(
        { browsers: "firefox", viewport: "400x300", timeout: 500, cookie: "a=b", element: "#box" },
        { browsers: ["chromium"] },
      ),
    ).toMatchObject({
      browsers: ["firefox"],
      viewport: { width: 400, height: 300 },
      timeout: 500,
      cookie: "a=b",
      element: "#box",
    });
  });
});
