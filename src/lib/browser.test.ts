import type { Browser, BrowserType } from "playwright";
import { describe, expect, it, vi } from "vitest";
import { withBrowser } from "./browser";

const fakeBrowserType = (launch: () => Promise<Partial<Browser>>) =>
  ({ name: () => "chromium", launch }) as unknown as BrowserType;

describe("withBrowser", () => {
  it("should close the browser and return the result", async () => {
    const close = vi.fn(async () => {});
    const result = await withBrowser(
      fakeBrowserType(async () => ({ close })),
      async () => "screenshot",
    );

    expect(result).toBe("screenshot");
    expect(close).toHaveBeenCalledOnce();
  });

  it("should close the browser when the callback throws", async () => {
    const close = vi.fn(async () => {});
    const run = withBrowser(
      fakeBrowserType(async () => ({ close })),
      async () => {
        throw new Error("navigation failed");
      },
    );

    await expect(run).rejects.toThrow("navigation failed");
    expect(close).toHaveBeenCalledOnce();
  });

  it("should point to `chromascope install` when the browser isn't installed", async () => {
    const run = withBrowser(
      fakeBrowserType(async () => {
        throw new Error("browserType.launch: Executable doesn't exist at /tmp/chromium/chrome");
      }),
      async () => "screenshot",
    );

    await expect(run).rejects.toMatchObject({
      code: "BROWSER_NOT_INSTALLED",
      category: "runtime",
      message: "chromium is not installed",
      hint: "run `chromascope install` to install the browsers",
    });
  });

  it("should rethrow other launch errors unchanged", async () => {
    const error = new Error("launch timed out");
    const run = withBrowser(
      fakeBrowserType(async () => {
        throw error;
      }),
      async () => "screenshot",
    );

    await expect(run).rejects.toBe(error);
  });
});
