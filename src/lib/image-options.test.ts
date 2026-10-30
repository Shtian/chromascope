import cac from "cac";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_OPTIONS,
  IMAGE_OPTION_KEYS,
  type ImageOptions,
  imageOptionArgs,
  imageOptionHelp,
  parseDeviceScaleFactor,
  parseImageOptions,
  parseViewport,
  parseWaitUntil,
  pickImageOptions,
  withoutDefaults,
} from "./image-options";

describe("option errors", () => {
  it("should be usage errors with a hint", () => {
    expect(() => parseViewport("big")).toThrow(
      expect.objectContaining({ code: "INVALID_OPTION", category: "usage", hint: expect.stringContaining("1280x720") }),
    );
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

describe("pickImageOptions", () => {
  it("should keep only the options that change the image", () => {
    const options = { ...DEFAULT_IMAGE_OPTIONS, mask: ["#clock"], browsers: ["chromium"], timeout: 0, cookie: "a=b" };
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

describe("withoutDefaults", () => {
  it("should keep only the image options that differ from the defaults", () => {
    expect(withoutDefaults(DEFAULT_IMAGE_OPTIONS)).toEqual({});
    expect(
      withoutDefaults({
        ...DEFAULT_IMAGE_OPTIONS,
        viewport: { width: 400, height: 300 },
        mask: ["#clock"],
        fullPage: true,
      }),
    ).toEqual({ viewport: { width: 400, height: 300 }, mask: ["#clock"], fullPage: true });
  });
});

/** A value other than the default for every image option, with characters a shell would split. */
const CHANGED: ImageOptions = {
  viewport: { width: 400, height: 300 },
  deviceScaleFactor: 2,
  element: "#main .card",
  fullPage: true,
  waitFor: "[data-ready='yes']",
  waitUntil: "networkidle",
  mask: ["#clock", ".ad banner"],
};

/** Parses the arguments the way the CLI does: with the CLI options from `imageOptionHelp`. */
const parseArgs = (args: string[]) => {
  const cli = cac("chromascope");
  const command = cli.command("snapshot <url>");
  for (const key of IMAGE_OPTION_KEYS) command.option(...imageOptionHelp(key));
  const { options } = cli.parse(["node", "chromascope", "snapshot", "http://localhost/", ...args], { run: false });
  return parseImageOptions(options);
};

describe("imageOptionArgs", () => {
  it("should pass every image option, repeating --mask", () => {
    expect(imageOptionArgs(CHANGED)).toEqual([
      "--viewport",
      "400x300",
      "--device-scale-factor",
      "2",
      "--element",
      "#main .card",
      "--full-page",
      "--wait-for",
      "[data-ready='yes']",
      "--wait-until",
      "networkidle",
      "--mask",
      "#clock",
      "--mask",
      ".ad banner",
    ]);
  });

  it("should leave out image options that are off, empty or not given", () => {
    expect(imageOptionArgs({ element: null, waitFor: null, fullPage: false, mask: [] })).toEqual([]);
  });

  it.each(IMAGE_OPTION_KEYS)("should render %s as flags that parse back to the same value", (key) => {
    expect(parseArgs(imageOptionArgs({ [key]: CHANGED[key] }))).toEqual({ [key]: CHANGED[key] });
  });

  it("should render every image option as flags that parse back to the same image options", () => {
    expect(parseArgs(imageOptionArgs(CHANGED))).toEqual(CHANGED);
  });
});

describe("imageOptionHelp", () => {
  it("should name the flag with its short flag and placeholder", () => {
    expect(imageOptionHelp("element")[0]).toBe("-e, --element <selector>");
    expect(imageOptionHelp("fullPage")[0]).toBe("-f, --full-page");
    expect(imageOptionHelp("viewport")[0]).toBe("--viewport <size>");
  });

  it("should show defaults that pass a flag, and leave out off and none", () => {
    expect(imageOptionHelp("viewport")[1]).toBe("Viewport size as <width>x<height> (default: 1280x720)");
    expect(imageOptionHelp("deviceScaleFactor")[1]).toMatch(/ \(default: 1\)$/);
    expect(imageOptionHelp("fullPage")[1]).toBe("Take a full page screenshot");
    expect(imageOptionHelp("mask")[1]).not.toContain("default");
  });

  it("should default to the baseline's value when the options come from the baseline", () => {
    for (const key of IMAGE_OPTION_KEYS) {
      expect(imageOptionHelp(key, { fromBaseline: true })[1]).toMatch(/ \(default: the baseline's\)$/);
    }
  });
});
