import path from "node:path";
import { PNG } from "pngjs";
import {
  type Baseline,
  type BaselineMetadata,
  baselineNotFound,
  type CaptureConflict,
  captureConflictError,
  deriveBaselineName,
  findCaptureConflicts,
} from "./baselines";
import type { BrowserName } from "./capture-options";
import { compareImages } from "./image";
import { type ImageOptions, withoutDefaults } from "./image-options";
import type { CompareComparison } from "./result";

type StoredBaseline = Pick<Baseline, "metadata" | "has">;

export type PlanComparisonInput<B extends StoredBaseline> = {
  /** The baseline name, given with `--name` or derived from the URL and element. */
  name: string;
  /** Absolute path of the folder the baselines are stored in. */
  root: string;
  /** The stored baseline, or `undefined` when there is none with this name. */
  baseline: B | undefined;
  /** The URL that was given, or `null` to use the baseline's. */
  url: string | null;
  /** Whether the name was given with `--name`, rather than derived. */
  nameGiven: boolean;
  /** The image options passed as flags. Each must match the baseline's, unless `update` is set. */
  imageFlags: Partial<ImageOptions>;
  /** The browsers that were given, or `null` for every browser of the baseline. */
  browsers: BrowserName[] | null;
  update: boolean;
  /** `--baseline-dir` as given, for the hint when the baseline is missing. */
  baselineDir?: string;
};

export type ComparisonPlan<B extends StoredBaseline> = {
  /** The baseline to compare against. */
  baseline: B;
  url: string;
  capture: ImageOptions;
  browsers: BrowserName[];
  /** The image option flags that differ from the baseline's. Only non-empty with `--update`. */
  conflicts: CaptureConflict[];
};

/**
 * Decides what a before/after comparison captures: the URL, capture options and browsers, taken from the baseline
 * unless given. Fails when the baseline or one of its browsers is missing, or an image option flag conflicts.
 */
export const planComparison = <B extends StoredBaseline>(input: PlanComparisonInput<B>): ComparisonPlan<B> => {
  const { name, baseline, imageFlags, update } = input;
  const { baselineDir } = input;

  if (!baseline) {
    throw baselineNotFound(`no baseline named ${JSON.stringify(name)} in ${input.root}`, {
      url: input.url,
      name: input.nameGiven ? name : undefined,
      capture: imageFlags,
      browsers: input.browsers ?? undefined,
      baselineDir,
    });
  }
  const { metadata } = baseline;

  const conflicts = findCaptureConflicts(metadata.capture, imageFlags);
  if (conflicts.length > 0 && !update) throw captureConflictError(conflicts);

  const browsers = input.browsers ?? metadata.browsers;
  const absent = browsers.filter((browser) => !baseline.has(browser));
  if (absent.length > 0) {
    // Recapture every browser with the stored options, so the baseline stays consistent and `compare` doesn't conflict.
    const url = input.url ?? metadata.url;
    const derivesName = deriveBaselineName(url, metadata.capture.element) === name;
    throw baselineNotFound(`baseline ${JSON.stringify(name)} has no ${absent.join(", ")} capture`, {
      url,
      name: input.nameGiven || !derivesName ? name : undefined,
      capture: withoutDefaults(metadata.capture),
      browsers: [...new Set([...metadata.browsers, ...browsers])],
      baselineDir,
    });
  }

  return {
    baseline,
    url: input.url ?? metadata.url,
    capture: { ...metadata.capture, ...imageFlags },
    browsers,
    conflicts,
  };
};

/**
 * The baseline that `compare --update` stores: the compared browsers, plus the browsers that weren't compared,
 * unless the capture options changed under them. `kept` lists the browsers whose stored image stays.
 */
export const updatedBaseline = ({
  stored,
  compared,
  conflicted,
  ...metadata
}: Omit<BaselineMetadata, "browsers"> & {
  stored: BaselineMetadata;
  compared: BrowserName[];
  /** Whether the capture options differ from the stored ones. */
  conflicted: boolean;
}) => {
  const kept = conflicted ? [] : stored.browsers.filter((browser) => !compared.includes(browser));
  return { kept, metadata: { ...metadata, browsers: [...kept, ...compared] } satisfies BaselineMetadata };
};

/** `--clean` deletes the baseline only when the comparison exits 0: within `--fail-above`, or with `--update`. */
export const shouldClean = ({
  clean,
  update,
  aboveFailAbove,
}: {
  clean: boolean;
  update: boolean;
  aboveFailAbove: boolean;
}) => clean && (update || !aboveFailAbove);

/**
 * Compares a browser's after capture against its before capture: the baseline in a before/after comparison, or the
 * first URL in a URL comparison. Returns the comparison and the before, after and diff images to write to the run
 * folder, by file name. File names are stable.
 */
export const compareBeforeAfter = (
  browser: BrowserName,
  before: Buffer,
  after: Buffer,
  runFolder: string,
  threshold: number,
) => {
  const names = { before: `before-${browser}.png`, after: `after-${browser}.png`, diff: `diff-${browser}.png` };
  const beforeImage = PNG.sync.read(before);
  const afterImage = PNG.sync.read(after);
  const { pixelChange, pixelChangePercentage, diff } = compareImages(beforeImage, afterImage, threshold);

  const comparison: CompareComparison = {
    browser,
    pixelChange,
    pixelChangePercentage,
    before: { width: beforeImage.width, height: beforeImage.height },
    after: { width: afterImage.width, height: afterImage.height },
    sizeChanged: beforeImage.width !== afterImage.width || beforeImage.height !== afterImage.height,
    beforePath: path.join(runFolder, names.before),
    afterPath: path.join(runFolder, names.after),
    diffPath: path.join(runFolder, names.diff),
  };
  const files: Array<[string, Buffer]> = [
    [names.before, before],
    [names.after, after],
    [names.diff, PNG.sync.write(diff)],
  ];
  return { comparison, files };
};
