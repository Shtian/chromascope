import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BLUE, fakeCapturer, png } from "../../test/fake-capturer";
import { parseCaptureOptions } from "../lib/capture-options";
import output from "../lib/output";
import { diff } from "./diff";

const URL = "http://localhost:3000/";

describe("diff", () => {
  let tempDir: string;

  beforeAll(() => {
    output.configure({ quiet: true });
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should compare every browser against the base browser", async () => {
    const { capturer } = fakeCapturer({ [`firefox ${URL}`]: png(4, 2, BLUE) });
    const { result, aboveFailAbove } = await diff(
      URL,
      {
        capture: parseCaptureOptions({}, { browsers: ["chromium", "webkit", "firefox"] }),
        base: "webkit",
        threshold: 0.2,
        failAbove: 1,
        saveDiff: true,
        run: { folder: tempDir },
      },
      capturer,
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      command: "diff",
      url: URL,
      base: "webkit",
      options: { browsers: ["webkit", "chromium", "firefox"], threshold: 0.2, failAbove: 1 },
      artifactsDir: path.join(tempDir, result.runId),
    });
    expect(result.comparisons.map(({ browser, pixelChangePercentage }) => [browser, pixelChangePercentage])).toEqual([
      ["chromium", 0],
      ["firefox", 100],
    ]);
    expect(aboveFailAbove).toBe(true);
  });
});
