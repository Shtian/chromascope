import { describe, expect, it } from "vitest";
import { isUrl, parseCookieOptions } from "./utils";

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
