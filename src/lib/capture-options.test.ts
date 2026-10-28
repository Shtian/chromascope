import { describe, expect, it } from "vitest";
import {
  parseBase,
  parseBrowsers,
  parseCaptureOptions,
  parseDeviceScaleFactor,
  parseImageOptions,
  parseTimeout,
  parseViewport,
  parseWaitUntil,
  pickImageOptions,
} from "./capture-options";

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

describe("option errors", () => {
  it("should be usage errors with a hint", () => {
    expect(() => parseViewport("big")).toThrow(
      expect.objectContaining({ code: "INVALID_OPTION", category: "usage", hint: expect.stringContaining("1280x720") }),
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

describe("parseViewport", () => {
  it.each([
    ["800x600", { width: 800, height: 600 }],
    ["1280X720", { width: 1280, height: 720 }],
    [" 375x812 ", { width: 375, height: 812 }],
  ])("should parse %j", (value, expected) => {
    expect(parseViewport(value)).toEqual(expected);
  });

  it.each(["800", "800x", "x600", "0x600", "800x-1", "80.5x600", "axb", 800, true])("should reject %j", (value) => {
    expect(() => parseViewport(value)).toThrow("--viewport must be <width>x<height>, like 1280x720");
  });
});

describe("parseDeviceScaleFactor", () => {
  it.each([1, 2, 0.5, "1.5", "3"])("should accept %j", (value) => {
    expect(parseDeviceScaleFactor(value)).toBe(Number(value));
  });

  it.each([0, -1, "", "abc", true])("should reject %j", (value) => {
    expect(() => parseDeviceScaleFactor(value)).toThrow("--device-scale-factor must be a number above 0");
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

describe("parseWaitUntil", () => {
  it.each(["load", "domcontentloaded", "networkidle"])("should accept %j", (value) => {
    expect(parseWaitUntil(value)).toBe(value);
  });

  it.each(["", "idle", 1])("should reject %j", (value) => {
    expect(() => parseWaitUntil(value)).toThrow("--wait-until must be one of load, domcontentloaded, networkidle");
  });
});

describe("parseImageOptions", () => {
  it("should leave options that weren't given undefined", () => {
    expect(parseImageOptions({})).toEqual({});
  });

  it("should parse the options that were given", () => {
    expect(
      parseImageOptions({
        viewport: "800x600",
        deviceScaleFactor: 2,
        element: "#box",
        fullPage: true,
        waitFor: ".ready",
        waitUntil: "networkidle",
      }),
    ).toEqual({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 2,
      element: "#box",
      fullPage: true,
      waitFor: ".ready",
      waitUntil: "networkidle",
    });
  });

  it.each([
    ["#clock", ["#clock"]],
    [
      ["#clock", ".ad"],
      ["#clock", ".ad"],
    ],
  ])("should parse --mask %j into a list", (mask, expected) => {
    expect(parseImageOptions({ mask })).toEqual({ mask: expected });
  });

  it.each(["element", "waitFor", "mask"])("should reject an empty %s selector", (name) => {
    expect(() => parseImageOptions({ [name]: "" })).toThrow("must be a selector");
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

describe("pickImageOptions", () => {
  it("should keep only the options that change the image", () => {
    const options = parseCaptureOptions({ cookie: "a=b", mask: "#clock" }, { browsers: ["chromium"] });
    expect(pickImageOptions(options)).toEqual({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      element: null,
      fullPage: false,
      waitFor: null,
      waitUntil: "load",
      mask: ["#clock"],
    });
  });
});
