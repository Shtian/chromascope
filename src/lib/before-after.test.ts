import { describe, expect, it } from "vitest";
import type { BaselineMetadata } from "./baselines";
import { type PlanComparisonInput, planComparison, shouldClean, updatedBaseline } from "./before-after";
import type { BrowserName } from "./capture-options";
import { DEFAULT_IMAGE_OPTIONS } from "./image-options";

const metadata: BaselineMetadata = {
  url: "http://localhost:3000/",
  browsers: ["chromium", "firefox"],
  capture: { ...DEFAULT_IMAGE_OPTIONS, element: "#box" },
  capturedAt: "2026-10-28T16:03:12.000Z",
  chromascopeVersion: "1.0.0",
};

const stored = (overrides: Partial<BaselineMetadata> = {}) => {
  const data = { ...metadata, ...overrides };
  return { metadata: data, has: (browser: BrowserName) => data.browsers.includes(browser) };
};

const plan = (overrides: Partial<PlanComparisonInput<ReturnType<typeof stored>>> = {}) =>
  planComparison({
    name: "home",
    root: "/app/.chromascope/baselines",
    baseline: stored(),
    url: null,
    nameGiven: true,
    imageFlags: {},
    browsers: null,
    update: false,
    ...overrides,
  });

describe("planComparison", () => {
  it("should take the URL, capture options and browsers from the baseline", () => {
    const baseline = stored();
    expect(plan({ baseline })).toEqual({
      baseline,
      url: "http://localhost:3000/",
      capture: metadata.capture,
      browsers: ["chromium", "firefox"],
      conflicts: [],
    });
  });

  it("should prefer the given URL, browsers and matching capture options", () => {
    expect(
      plan({
        url: "http://localhost:4000/",
        browsers: ["firefox"],
        imageFlags: { element: "#box", viewport: { width: 1280, height: 720 } },
      }),
    ).toMatchObject({ url: "http://localhost:4000/", capture: metadata.capture, browsers: ["firefox"], conflicts: [] });
  });

  it("should fail with the snapshot command to run when there is no baseline with the name", () => {
    expect(() => plan({ baseline: undefined, url: "http://localhost:3000/" })).toThrow(
      expect.objectContaining({
        code: "BASELINE_NOT_FOUND",
        message: 'no baseline named "home" in /app/.chromascope/baselines',
        hint: "capture one first: chromascope snapshot http://localhost:3000/ --name home",
      }),
    );
  });

  it("should put every image option that was given in the snapshot command", () => {
    expect(() =>
      plan({
        baseline: undefined,
        name: "127-0-0-1-3000__box",
        nameGiven: false,
        url: "http://127.0.0.1:3000/",
        browsers: ["firefox"],
        imageFlags: {
          element: "#box",
          viewport: { width: 400, height: 300 },
          mask: ["#clock", ".a b"],
          fullPage: true,
        },
        baselineDir: "my baselines",
      }),
    ).toThrow(
      expect.objectContaining({
        hint: "capture one first: chromascope snapshot http://127.0.0.1:3000/ --viewport 400x300 --element '#box' --full-page --mask '#clock' --mask '.a b' --browsers firefox --baseline-dir 'my baselines'",
      }),
    );
  });

  it("should fail on a capture option that differs from the baseline's", () => {
    expect(() => plan({ imageFlags: { viewport: { width: 800, height: 600 } } })).toThrow(
      expect.objectContaining({ code: "CAPTURE_OPTION_CONFLICT" }),
    );
  });

  it("should accept a differing capture option with --update, and report the conflict", () => {
    const { capture, conflicts } = plan({ imageFlags: { viewport: { width: 800, height: 600 } }, update: true });
    expect(capture.viewport).toEqual({ width: 800, height: 600 });
    expect(capture.element).toBe("#box");
    expect(conflicts).toEqual([{ flag: "--viewport", flagValue: "800x600", baselineValue: "1280x720" }]);
  });

  it("should fail for a browser without a baseline, with the snapshot command that recaptures it the same way", () => {
    const baseline = stored({
      capture: {
        ...metadata.capture,
        viewport: { width: 400, height: 300 },
        waitUntil: "networkidle",
        mask: ["#clock"],
      },
    });
    expect(() => plan({ baseline, browsers: ["webkit", "chromium"] })).toThrow(
      expect.objectContaining({
        code: "BASELINE_NOT_FOUND",
        message: 'baseline "home" has no webkit capture',
        hint: "capture one first: chromascope snapshot http://localhost:3000/ --name home --viewport 400x300 --element '#box' --wait-until networkidle --mask '#clock' --browsers chromium,firefox,webkit",
      }),
    );
  });

  it("should name the baseline in the snapshot command when the stored options derive another name", () => {
    const snapshotHint = (name: string) => {
      try {
        plan({ name, nameGiven: false, url: "http://localhost:3000/", browsers: ["webkit"] });
      } catch (error) {
        return (error as { hint: string }).hint;
      }
    };
    // The baseline has `--element #box`, so the URL and element derive `localhost-3000__box`.
    expect(snapshotHint("localhost-3000__box")).not.toContain("--name");
    expect(snapshotHint("localhost-3000")).toContain("--name localhost-3000 ");
  });
});

describe("updatedBaseline", () => {
  const update = {
    stored: metadata,
    url: "http://localhost:3000/",
    capture: metadata.capture,
    capturedAt: "2026-10-29T08:00:00.000Z",
    chromascopeVersion: "2.0.0",
  };

  it("should keep the browsers that weren't compared", () => {
    expect(updatedBaseline({ ...update, compared: ["firefox"], conflicted: false })).toEqual({
      kept: ["chromium"],
      metadata: {
        url: "http://localhost:3000/",
        browsers: ["chromium", "firefox"],
        capture: metadata.capture,
        capturedAt: "2026-10-29T08:00:00.000Z",
        chromascopeVersion: "2.0.0",
      },
    });
  });

  it("should drop the browsers that weren't compared when the capture options changed under them", () => {
    const capture = { ...metadata.capture, viewport: { width: 800, height: 600 } };
    const { kept, metadata: updated } = updatedBaseline({
      ...update,
      capture,
      compared: ["firefox"],
      conflicted: true,
    });
    expect(kept).toEqual([]);
    expect(updated.browsers).toEqual(["firefox"]);
    expect(updated.capture).toBe(capture);
  });

  it("should add newly compared browsers after the kept ones", () => {
    expect(updatedBaseline({ ...update, compared: ["webkit"], conflicted: false }).metadata.browsers).toEqual([
      "chromium",
      "firefox",
      "webkit",
    ]);
  });
});

describe("shouldClean", () => {
  it.each([
    [{ clean: true, update: false, aboveFailAbove: false }, true],
    [{ clean: true, update: false, aboveFailAbove: true }, false],
    [{ clean: false, update: false, aboveFailAbove: false }, false],
    [{ clean: true, update: true, aboveFailAbove: true }, true],
  ])("should clean only when asked and the comparison exits 0: %j", (input, expected) => {
    expect(shouldClean(input)).toBe(expected);
  });
});
