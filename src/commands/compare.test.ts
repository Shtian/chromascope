import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { version } from "../../package.json";
import { BLUE, fakeCapturer, png, RED } from "../../test/fake-capturer";
import { type BaselineStore, createBaselineStore } from "../lib/baselines";
import { DEFAULT_IMAGE_OPTIONS } from "../lib/image-options";
import output from "../lib/output";
import { type CompareOptions, compare } from "./compare";

const URL = "http://localhost:3000/";

describe("compare", () => {
  let tempDir: string;
  let store: BaselineStore;

  beforeAll(() => {
    output.configure({ quiet: true });
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-"));
    store = createBaselineStore(path.join(tempDir, "baselines"));
    store.write(
      "home",
      {
        url: URL,
        browsers: ["chromium", "firefox"],
        capture: { ...DEFAULT_IMAGE_OPTIONS, element: "#box" },
        capturedAt: "2026-10-28T16:03:12.000Z",
        chromascopeVersion: "1.0.0",
      },
      { chromium: png(4, 2, RED), firefox: png(4, 2, RED) },
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const options = (overrides: Partial<CompareOptions> = {}): CompareOptions => ({
    url: null,
    name: "home",
    capture: { imageFlags: {}, browsers: null, timeout: 5000, cookie: "" },
    threshold: 0.2,
    failAbove: 0,
    update: false,
    clean: false,
    run: { folder: path.join(tempDir, "runs") },
    ...overrides,
  });

  it("should capture the baseline's URL with its image options and compare each browser against its baseline", async () => {
    const { capturer, calls } = fakeCapturer({ [`firefox ${URL}`]: png(4, 2, BLUE) });
    const { result, aboveFailAbove } = await compare(options(), store, capturer);

    expect(calls).toEqual([`chromium ${URL}`, `firefox ${URL}`]);
    expect(result).toMatchObject({
      schemaVersion: 1,
      command: "compare",
      name: "home",
      baselineDir: path.join(tempDir, "baselines", "home"),
      url: URL,
      options: { element: "#box", browsers: ["chromium", "firefox"], timeout: 5000, failAbove: 0 },
      artifactsDir: path.join(tempDir, "runs", result.runId),
      updated: false,
      cleaned: false,
    });
    expect(result.comparisons.map(({ browser, pixelChangePercentage }) => [browser, pixelChangePercentage])).toEqual([
      ["chromium", 0],
      ["firefox", 100],
    ]);
    expect(aboveFailAbove).toBe(true);
  });

  it("should save the capture as the baseline with --update, keeping the browsers it didn't compare", async () => {
    const { capturer } = fakeCapturer({ [`firefox ${URL}`]: png(4, 2, BLUE) });
    const capture = { imageFlags: {}, browsers: ["firefox" as const], timeout: 5000, cookie: "" };
    const { result } = await compare(options({ update: true, capture }), store, capturer);

    expect(result.updated).toBe(true);
    const baseline = store.read("home");
    expect(baseline?.metadata).toMatchObject({ browsers: ["chromium", "firefox"], chromascopeVersion: version });
    expect(fs.readFileSync(baseline?.imagePath("firefox") ?? "")).toEqual(png(4, 2, BLUE));
    expect(fs.readFileSync(baseline?.imagePath("chromium") ?? "")).toEqual(png(4, 2, RED));
  });

  it("should delete the baseline with --clean when the comparison passes", async () => {
    const { result } = await compare(options({ clean: true }), store, fakeCapturer().capturer);

    expect(result.cleaned).toBe(true);
    expect(store.read("home")).toBeUndefined();
  });

  it("should fail when there is no baseline with the name", async () => {
    await expect(compare(options({ name: "missing" }), store, fakeCapturer().capturer)).rejects.toThrow(
      'no baseline named "missing"',
    );
  });
});
