import { describe, expect, it } from "vitest";
import {
  isAboveFailAbove,
  isLoopbackHost,
  isUrl,
  normalizeUrl,
  parseCookieOptions,
  parseFailAbove,
  parseThreshold,
  parseUrl,
} from "./utils";

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
    ["localhost:3000", "http://localhost:3000/"],
    ["localhost", "http://localhost/"],
    ["localhost:3000/about?foo=bar", "http://localhost:3000/about?foo=bar"],
    ["127.0.0.1:8080", "http://127.0.0.1:8080/"],
    ["127.1.2.3", "http://127.1.2.3/"],
    ["[::1]:3000", "http://[::1]:3000/"],
    ["app.localhost:5173", "http://app.localhost:5173/"],
    ["http://localhost:3000", "http://localhost:3000/"],
    ["https://localhost:3000", "https://localhost:3000/"],
    ["https://127.0.0.1", "https://127.0.0.1/"],
    ["192.168.1.10:3000", "https://192.168.1.10:3000/"],
    ["[::2]", "https://[::2]/"],
    ["localhost.chromascope.dev", "https://localhost.chromascope.dev/"],
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

describe("isLoopbackHost", () => {
  it.each(["localhost", "app.localhost", "127.0.0.1", "127.255.0.9", "[::1]"])(
    "should treat %j as loopback",
    (host) => {
      expect(isLoopbackHost(host)).toBe(true);
    },
  );
  it.each(["chromascope.dev", "localhost.chromascope.dev", "128.0.0.1", "0.0.0.0", "[::2]", "mylocalhost"])(
    "should not treat %j as loopback",
    (host) => {
      expect(isLoopbackHost(host)).toBe(false);
    },
  );
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
    expect(() => parseThreshold(value)).toThrow(
      expect.objectContaining({
        code: "INVALID_OPTION",
        category: "usage",
        message: expect.stringContaining("--threshold must be a number between 0 and 1"),
      }),
    );
  });
});

describe("parseFailAbove", () => {
  it.each([0, 0.5, 100, "0", "12.5"])("should accept %j", (value) => {
    expect(parseFailAbove(value)).toBe(Number(value));
  });
  it.each(["abc", "", -1, 101, true, undefined])("should reject %j as an invalid option", (value) => {
    expect(() => parseFailAbove(value)).toThrow(
      expect.objectContaining({
        code: "INVALID_OPTION",
        category: "usage",
        message: expect.stringContaining("--fail-above must be a percentage between 0 and 100"),
      }),
    );
  });
});

describe("isAboveFailAbove", () => {
  it("should never fail without --fail-above", () => {
    expect(isAboveFailAbove([100], null)).toBe(false);
  });
  it("should fail when any percentage is above --fail-above", () => {
    expect(isAboveFailAbove([0, 0.6], 0.5)).toBe(true);
    expect(isAboveFailAbove([0.01], 0)).toBe(true);
  });
  it("should pass when every percentage is at or below --fail-above", () => {
    expect(isAboveFailAbove([0, 0.5], 0.5)).toBe(false);
    expect(isAboveFailAbove([], 0)).toBe(false);
  });
});

describe("parseUrl", () => {
  it("should normalize a valid url", () => {
    expect(parseUrl("localhost:3000")).toBe("http://localhost:3000/");
  });
  it.each(["not a url", "", undefined])("should reject %j as an invalid url", (value) => {
    expect(() => parseUrl(value)).toThrow(expect.objectContaining({ code: "INVALID_URL", category: "usage" }));
  });
});
