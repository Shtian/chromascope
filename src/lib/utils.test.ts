import { describe, expect, it } from "vitest";
import { isUrl, normalizeUrl, parseCookieOptions, parseThreshold } from "./utils";

describe("isUrl", () => {
  it("should allow localhost urls", () => {
    const url = "http://localhost:3000";
    expect(isUrl(url)).toBe(true);
  });
  it("should allow urls with a domain", () => {
    const url = "https://chromascope.dev";
    expect(isUrl(url)).toBe(true);
  });
  it("should allow urls with a path", () => {
    const url = "https://chromascope.dev/about";
    expect(isUrl(url)).toBe(true);
  });
  it("should allow urls with a query string", () => {
    const url = "https://chromascope.dev/about?foo=bar";
    expect(isUrl(url)).toBe(true);
  });
  it("should allow urls with a hash", () => {
    const url = "https://chromascope.dev/about#foo";
    expect(isUrl(url)).toBe(true);
  });
  it("should allow urls with a port", () => {
    const url = "https://chromascope.dev:3000/about";
    expect(isUrl(url)).toBe(true);
  });
  it("should allow urls without a protocol", () => {
    const url = "chromascope.dev";
    expect(isUrl(url)).toBe(true);
  });
  it("should not allow urls without a domain", () => {
    const url = "https://";
    expect(isUrl(url)).toBe(false);
  });
  it.each([
    "http://127.0.0.1:8080",
    "http://[::1]:3000/",
    "localhost",
    "localhost:3000/path",
    "sub.domain.chromascope.dev",
    "https://chromascope.dev/a/b?x=1&y=two%20words#top",
    "HTTPS://CHROMASCOPE.DEV",
  ])("should allow %j", (url) => {
    expect(isUrl(url)).toBe(true);
  });
  it.each([
    "",
    "   ",
    "chromascope",
    "https://chromascope",
    "chroma scope.dev",
    "https://chroma scope.dev",
    "ftp://chromascope.dev",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "mailto:me@chromascope.dev",
    "http://",
    "https://.",
    "http:/chromascope.dev",
    "-",
  ])("should not allow %j", (url) => {
    expect(isUrl(url)).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it.each([
    ["chromascope.dev", "https://chromascope.dev/"],
    ["localhost:3000", "https://localhost:3000/"],
    ["http://localhost:3000", "http://localhost:3000/"],
    ["https://chromascope.dev/about?foo=bar#baz", "https://chromascope.dev/about?foo=bar#baz"],
    ["httpbin.org", "https://httpbin.org/"],
    ["  chromascope.dev  ", "https://chromascope.dev/"],
  ])("should normalize %j to %j", (url, expected) => {
    expect(normalizeUrl(url)).toBe(expected);
  });
  it("should return undefined for invalid urls", () => {
    expect(normalizeUrl("not a url")).toBeUndefined();
  });
});

describe("parseCookieOptions", () => {
  const url = "https://example.com";
  it("should parse cookies", () => {
    const cookies = "foo=bar;bar=baz";
    expect(parseCookieOptions(cookies, url)).toEqual([
      { name: "foo", value: "bar", url },
      { name: "bar", value: "baz", url },
    ]);
  });
  it("should parse single cookie", () => {
    const cookies = "foo=bar";
    expect(parseCookieOptions(cookies, url)).toEqual([{ name: "foo", value: "bar", url }]);
  });
  it("should parse cookies with spaces", () => {
    const cookies = "foo = bar; bar = baz";
    expect(parseCookieOptions(cookies, url)).toEqual([
      { name: "foo", value: "bar", url },
      { name: "bar", value: "baz", url },
    ]);
  });
  it("should parse an empty string without throwing", () => {
    const cookies = "";
    expect(parseCookieOptions(cookies, url)).toEqual([]);
  });
  it("should parse a value with an equals sign", () => {
    const cookies =
      "CookieConsent={stamp:%27WxrO46wiM4iF3wmVF00zO/M3+azPktEBeauYQCSr2t2oLxf8s+u42A==%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:2%2Cutc:1677699545253%2Cregion:%27no%27}";
    expect(parseCookieOptions(cookies, url)).toEqual([
      {
        name: "CookieConsent",
        value:
          "{stamp:%27WxrO46wiM4iF3wmVF00zO/M3+azPktEBeauYQCSr2t2oLxf8s+u42A==%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:2%2Cutc:1677699545253%2Cregion:%27no%27}",
        url,
      },
    ]);
  });
});

describe("parseThreshold", () => {
  it.each([0, 0.2, 1, "0", "0.5", "1"])("should accept %j", (value) => {
    expect(parseThreshold(value)).toBe(Number(value));
  });
  it.each(["abc", "", -0.1, 1.1, "2", Number.NaN, true, undefined])("should reject %j", (value) => {
    expect(() => parseThreshold(value)).toThrow("--threshold must be a number between 0 and 1");
  });
});
