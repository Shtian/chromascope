import { beforeAll, describe, expect, it } from "vitest";
import { parseCaptureOptions } from "./capture-options";
import { captureAll } from "./capturer";
import output from "./output";

const options = parseCaptureOptions({}, { browsers: ["chromium", "firefox"] });

describe("captureAll", () => {
  beforeAll(() => {
    output.configure({ quiet: true });
  });

  it("should capture the page in every browser, in the order given", async () => {
    const captured: string[] = [];
    const captures = await captureAll(
      async (browser, url) => {
        captured.push(`${browser} ${url}`);
        return Buffer.from(browser);
      },
      ["firefox", "chromium"],
      "http://localhost:3000/",
      options,
    );

    expect(captured.sort()).toEqual(["chromium http://localhost:3000/", "firefox http://localhost:3000/"]);
    expect(captures.map(({ browser, image }) => [browser, image.toString()])).toEqual([
      ["firefox", "firefox"],
      ["chromium", "chromium"],
    ]);
    for (const { ms } of captures) expect(ms).toBeGreaterThanOrEqual(0);
  });

  it("should pass the capture options to the capturer", async () => {
    let passed: unknown;
    await captureAll(
      async (_browser, _url, given) => {
        passed = given;
        return Buffer.from("");
      },
      ["chromium"],
      "http://localhost:3000/",
      options,
    );
    expect(passed).toBe(options);
  });

  it("should wait for every capture to settle, then throw the first failure", async () => {
    let webkitSettled = false;
    const failing = captureAll(
      async (browser) => {
        if (browser === "webkit") {
          await new Promise((resolve) => setTimeout(resolve, 10));
          webkitSettled = true;
          return Buffer.from("");
        }
        throw new Error(`${browser} failed`);
      },
      ["chromium", "webkit", "firefox"],
      "http://localhost:3000/",
      options,
    );

    await expect(failing).rejects.toThrow("chromium failed");
    expect(webkitSettled).toBe(true);
  });
});
