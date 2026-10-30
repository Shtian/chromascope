import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BLUE, fakeCapturer, png } from "../../test/fake-capturer";
import { parseCaptureOptions } from "../lib/capture-options";
import output from "../lib/output";
import { versus } from "./versus";

const BEFORE_URL = "http://localhost:3000/";
const AFTER_URL = "http://localhost:4000/";

describe("versus", () => {
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

  it("should compare each browser's capture of the after URL against its capture of the before URL", async () => {
    const { capturer, calls } = fakeCapturer({ [`chromium ${AFTER_URL}`]: png(4, 2, BLUE) });
    const { result, aboveFailAbove } = await versus(
      {
        beforeUrl: BEFORE_URL,
        afterUrl: AFTER_URL,
        capture: parseCaptureOptions({}, { browsers: ["chromium"] }),
        threshold: 0.2,
        failAbove: null,
        run: { folder: tempDir, out: path.join(tempDir, "out") },
      },
      capturer,
    );

    expect(calls).toEqual([`chromium ${BEFORE_URL}`, `chromium ${AFTER_URL}`]);
    expect(result).toMatchObject({
      schemaVersion: 1,
      command: "versus",
      beforeUrl: BEFORE_URL,
      afterUrl: AFTER_URL,
      artifactsDir: path.join(tempDir, "out"),
      comparisons: [{ browser: "chromium", pixelChangePercentage: 100 }],
    });
    expect(aboveFailAbove).toBe(false);
  });
});
