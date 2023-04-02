import { isUrl } from "./utils";
import { describe, expect, it } from "vitest";

describe("utils", () => {
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
