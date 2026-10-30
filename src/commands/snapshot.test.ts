import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { version } from "../../package.json";
import { fakeCapturer, png, RED } from "../../test/fake-capturer";
import { createBaselineStore } from "../lib/baselines";
import { parseCaptureOptions } from "../lib/capture-options";
import { DEFAULT_IMAGE_OPTIONS } from "../lib/image-options";
import output from "../lib/output";
import { snapshot } from "./snapshot";

const URL = "http://localhost:3000/";

describe("snapshot", () => {
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

  it("should store a baseline per browser with its image options", async () => {
    const store = createBaselineStore(tempDir);
    const capture = { ...parseCaptureOptions({}, { browsers: ["chromium", "firefox"] }), element: "#box" };

    const result = await snapshot(URL, "home", capture, store, fakeCapturer().capturer);

    const dir = path.join(tempDir, "home");
    expect(result).toMatchObject({
      schemaVersion: 1,
      command: "snapshot",
      name: "home",
      baselineDir: dir,
      url: URL,
      options: { ...DEFAULT_IMAGE_OPTIONS, element: "#box", browsers: ["chromium", "firefox"], timeout: 30_000 },
      baselines: { chromium: path.join(dir, "chromium.png"), firefox: path.join(dir, "firefox.png") },
    });
    expect(Object.keys(result.timings.captureMs)).toEqual(["chromium", "firefox"]);
    expect(fs.readFileSync(path.join(dir, "firefox.png"))).toEqual(png(4, 2, RED));
    expect(store.read("home")?.metadata).toEqual({
      url: URL,
      browsers: ["chromium", "firefox"],
      capture: { ...DEFAULT_IMAGE_OPTIONS, element: "#box" },
      capturedAt: result.capturedAt,
      chromascopeVersion: version,
    });
  });
});
