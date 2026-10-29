import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type BaselineMetadata,
  baselineNotFound,
  captureConflictError,
  createBaselineStore,
  DEFAULT_BASELINE_DIR,
  deriveBaselineName,
  findCaptureConflicts,
  parseBaselineName,
  snapshotCommand,
} from "./baselines";
import { DEFAULT_IMAGE_OPTIONS } from "./image-options";

describe("deriveBaselineName", () => {
  it.each([
    ["http://localhost:3000/pricing", null, "localhost-3000_pricing"],
    ["http://localhost:3000/pricing", ".card", "localhost-3000_pricing__card"],
    ["https://chromascope.dev/", null, "chromascope-dev"],
    ["https://chromascope.dev/a/b/", "#main > .card:first-child", "chromascope-dev_a_b__main-card-first-child"],
    ["http://127.0.0.1:8080/docs/getting%20started", null, "127-0-0-1-8080_docs_getting-20started"],
    ["http://[::1]:3000/", null, "1-3000"],
  ])("should derive the name of %j with element %j", (url, element, expected) => {
    expect(deriveBaselineName(url, element)).toBe(expected);
  });

  it("should ignore the query and hash", () => {
    expect(deriveBaselineName("https://chromascope.dev/a?b=c#d", null)).toBe("chromascope-dev_a");
  });

  it("should derive a safe name from a selector without letters", () => {
    expect(deriveBaselineName("https://chromascope.dev/", "*")).toBe("chromascope-dev__element");
  });

  it("should shorten long names and keep them unique", () => {
    const long = `https://chromascope.dev/${"a".repeat(200)}`;
    const name = deriveBaselineName(long, null);
    expect(name.length).toBeLessThanOrEqual(100);
    expect(name).not.toBe(deriveBaselineName(`${long}b`, null));
    expect(parseBaselineName(name)).toBe(name);
  });
});

describe("parseBaselineName", () => {
  it.each(["pricing", "localhost-3000_pricing__card", "v1.2"])("should accept %j", (name) => {
    expect(parseBaselineName(name)).toBe(name);
  });

  it.each(["", "..", "../x", "a/b", ".hidden", "with space", "a".repeat(101), 1])("should reject %j", (name) => {
    expect(() => parseBaselineName(name)).toThrow(
      expect.objectContaining({
        code: "INVALID_OPTION",
        category: "usage",
        message: expect.stringContaining("--name"),
      }),
    );
  });
});

describe("findCaptureConflicts", () => {
  const stored = { ...DEFAULT_IMAGE_OPTIONS, mask: ["#clock", ".ad"] };

  it("should find nothing when no option was given", () => {
    expect(findCaptureConflicts(stored, {})).toEqual([]);
  });

  it("should find nothing when the given options match", () => {
    expect(
      findCaptureConflicts(stored, {
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        fullPage: false,
        waitUntil: "load",
        mask: [".ad", "#clock"],
      }),
    ).toEqual([]);
  });

  it("should name every option that differs, with both values", () => {
    expect(
      findCaptureConflicts(stored, {
        viewport: { width: 800, height: 600 },
        element: "#box",
        fullPage: true,
        mask: ["#clock"],
      }),
    ).toEqual([
      { flag: "--viewport", flagValue: "800x600", baselineValue: "1280x720" },
      { flag: "--element", flagValue: "#box", baselineValue: "none" },
      { flag: "--full-page", flagValue: "on", baselineValue: "off" },
      { flag: "--mask", flagValue: "#clock", baselineValue: "#clock, .ad" },
    ]);
  });
});

describe("captureConflictError", () => {
  it("should be a usage error naming the options and suggesting how to recapture", () => {
    const error = captureConflictError([
      { flag: "--viewport", flagValue: "800x600", baselineValue: "1280x720" },
      { flag: "--full-page", flagValue: "on", baselineValue: "off" },
    ]);
    expect(error).toMatchObject({ code: "CAPTURE_OPTION_CONFLICT", category: "usage" });
    expect(error.message).toBe(
      "--viewport 800x600 differs from the baseline's 1280x720; --full-page on differs from the baseline's off",
    );
    expect(error.hint).toContain("chromascope snapshot");
    expect(error.hint).toContain("compare --update");
  });
});

describe("snapshotCommand", () => {
  it("should build the snapshot command, quoting what the shell would split", () => {
    expect(
      snapshotCommand({
        url: "http://localhost:3000/a?b=c",
        name: "pricing",
        capture: { element: "#main .card" },
        browsers: ["chromium", "firefox"],
        baselineDir: "my baselines",
      }),
    ).toBe(
      "chromascope snapshot 'http://localhost:3000/a?b=c' --name pricing --element '#main .card' --browsers chromium,firefox --baseline-dir 'my baselines'",
    );
  });

  it("should pass every image option, repeating --mask", () => {
    expect(
      snapshotCommand({
        url: "http://localhost:3000/",
        capture: {
          viewport: { width: 400, height: 300 },
          deviceScaleFactor: 2,
          element: "#box",
          fullPage: true,
          waitFor: ".ready",
          waitUntil: "networkidle",
          mask: ["#clock", ".ad banner"],
        },
      }),
    ).toBe(
      "chromascope snapshot http://localhost:3000/ --viewport 400x300 --device-scale-factor 2 --element '#box' --full-page --wait-for .ready --wait-until networkidle --mask '#clock' --mask '.ad banner'",
    );
  });

  it("should leave out image options that are off or empty", () => {
    expect(
      snapshotCommand({
        url: "http://localhost:3000/",
        capture: { element: null, waitFor: null, fullPage: false, mask: [] },
      }),
    ).toBe("chromascope snapshot http://localhost:3000/");
  });

  it("should leave out what wasn't given, and use a placeholder for a missing URL", () => {
    expect(snapshotCommand({ url: null })).toBe("chromascope snapshot <url>");
    expect(snapshotCommand({ url: "http://localhost:3000/" })).toBe("chromascope snapshot http://localhost:3000/");
  });

  it("should escape single quotes", () => {
    expect(snapshotCommand({ url: null, capture: { element: "[title='x']", mask: ["a[href$='.pdf']"] } })).toBe(
      "chromascope snapshot <url> --element '[title='\\''x'\\'']' --mask 'a[href$='\\''.pdf'\\'']'",
    );
  });
});

describe("baselineNotFound", () => {
  it("should be a runtime error with the snapshot command to run", () => {
    const error = baselineNotFound("no baseline named pricing", { url: "http://localhost:3000/", name: "pricing" });
    expect(error).toMatchObject({ code: "BASELINE_NOT_FOUND", category: "runtime" });
    expect(error.hint).toBe("capture one first: chromascope snapshot http://localhost:3000/ --name pricing");
  });
});

describe("createBaselineStore", () => {
  let tempDir: string;
  const metadata: BaselineMetadata = {
    url: "http://localhost:3000/",
    browsers: ["chromium", "firefox"],
    capture: DEFAULT_IMAGE_OPTIONS,
    capturedAt: "2026-10-28T16:03:12.000Z",
    chromascopeVersion: "1.0.0",
  };
  const images = { chromium: Buffer.from("chromium"), firefox: Buffer.from("firefox") };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const files = () => fs.readdirSync(tempDir, { recursive: true, encoding: "utf8" }).sort();

  it("should return the folder and the absolute path of each image it wrote", () => {
    const store = createBaselineStore(undefined, tempDir);
    const dir = path.join(store.root, "home");
    expect(store.write("home", metadata, images)).toEqual({
      dir,
      images: { chromium: path.join(dir, "chromium.png"), firefox: path.join(dir, "firefox.png") },
    });
  });

  it("should default to .chromascope/baselines and ignore .chromascope in git", () => {
    const store = createBaselineStore(undefined, tempDir);
    expect(store.root).toBe(path.join(tempDir, DEFAULT_BASELINE_DIR));
    store.write("home", metadata, images);
    expect(fs.readFileSync(path.join(tempDir, ".chromascope", ".gitignore"), "utf8")).toBe("*\n");
    expect(files()).toEqual([
      ".chromascope",
      ".chromascope/.gitignore",
      ".chromascope/baselines",
      ".chromascope/baselines/home",
      ".chromascope/baselines/home/chromium.png",
      ".chromascope/baselines/home/firefox.png",
      ".chromascope/baselines/home/metadata.json",
    ]);
  });

  it("should leave an existing .chromascope folder alone", () => {
    fs.mkdirSync(path.join(tempDir, ".chromascope"));
    createBaselineStore(undefined, tempDir).write("home", metadata, images);
    expect(fs.existsSync(path.join(tempDir, ".chromascope", ".gitignore"))).toBe(false);
  });

  it("should store baselines in --baseline-dir, without a .gitignore", () => {
    const store = createBaselineStore("custom", tempDir);
    expect(store.root).toBe(path.join(tempDir, "custom"));
    store.write("home", metadata, images);
    expect(files()).toEqual([
      "custom",
      "custom/home",
      "custom/home/chromium.png",
      "custom/home/firefox.png",
      "custom/home/metadata.json",
    ]);
  });

  it.each([
    [".chromascope/other", ".chromascope"],
    ["nested/.chromascope/baselines", "nested/.chromascope"],
    [".chromascope", ".chromascope"],
  ])("should ignore a .chromascope folder it creates for --baseline-dir %j in git", (baselineDir, created) => {
    createBaselineStore(baselineDir, tempDir).write("home", metadata, images);
    expect(fs.readFileSync(path.join(tempDir, created, ".gitignore"), "utf8")).toBe("*\n");
    expect(files().filter((file) => file.endsWith(".gitignore"))).toEqual([path.join(created, ".gitignore")]);
  });

  it("should leave an existing .chromascope folder alone with --baseline-dir", () => {
    fs.mkdirSync(path.join(tempDir, ".chromascope"));
    createBaselineStore(".chromascope/other", tempDir).write("home", metadata, images);
    expect(fs.existsSync(path.join(tempDir, ".chromascope", ".gitignore"))).toBe(false);
  });

  it("should never touch the project's own .gitignore", () => {
    fs.writeFileSync(path.join(tempDir, ".gitignore"), "node_modules\n");
    createBaselineStore(undefined, tempDir).write("home", metadata, images);
    expect(fs.readFileSync(path.join(tempDir, ".gitignore"), "utf8")).toBe("node_modules\n");
  });

  it("should read back what was written", () => {
    const store = createBaselineStore("baselines", tempDir);
    store.write("home", metadata, images);
    const baseline = store.read("home");
    expect(baseline?.metadata).toEqual(metadata);
    expect(baseline?.dir).toBe(path.join(tempDir, "baselines", "home"));
    expect(baseline?.imagePath("firefox")).toBe(path.join(tempDir, "baselines", "home", "firefox.png"));
    expect(baseline?.has("firefox")).toBe(true);
    expect(baseline?.has("webkit")).toBe(false);
  });

  it("should replace the whole baseline when written again", () => {
    const store = createBaselineStore("baselines", tempDir);
    store.write("home", metadata, images);
    store.write("home", { ...metadata, browsers: ["webkit"] }, { webkit: Buffer.from("webkit") });
    expect(fs.readdirSync(path.join(tempDir, "baselines", "home")).sort()).toEqual(["metadata.json", "webkit.png"]);
  });

  it("should not find a baseline that doesn't exist", () => {
    expect(createBaselineStore("baselines", tempDir).read("nope")).toBeUndefined();
  });

  it("should not find a browser whose image is gone", () => {
    const store = createBaselineStore("baselines", tempDir);
    store.write("home", metadata, images);
    fs.rmSync(path.join(tempDir, "baselines", "home", "firefox.png"));
    expect(store.read("home")?.has("firefox")).toBe(false);
  });

  it("should fail on unreadable metadata", () => {
    const store = createBaselineStore("baselines", tempDir);
    store.write("home", metadata, images);
    fs.writeFileSync(path.join(tempDir, "baselines", "home", "metadata.json"), "{");
    expect(() => store.read("home")).toThrow(expect.objectContaining({ code: "BASELINE_INVALID" }));
  });

  it("should remove one name, or all of them", () => {
    const store = createBaselineStore("baselines", tempDir);
    store.write("home", metadata, images);
    store.write("about", metadata, images);
    fs.mkdirSync(path.join(tempDir, "runs"));

    expect(store.remove("home")).toBe(path.join(tempDir, "baselines", "home"));
    expect(store.read("home")).toBeUndefined();
    expect(store.read("about")).toBeDefined();

    expect(store.removeAll()).toBe(path.join(tempDir, "baselines"));
    expect(files()).toEqual(["runs"]);
  });

  it("should remove nothing, without failing, when there is nothing to remove", () => {
    const store = createBaselineStore("baselines", tempDir);
    expect(store.remove("home")).toBeNull();
    expect(store.removeAll()).toBeNull();
  });
});
