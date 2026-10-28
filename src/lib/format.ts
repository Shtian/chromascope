import type { CleanResult, CompareResult, DiffComparison, DiffResult, Size, SnapshotResult } from "./result";

const displayNames: Record<string, string> = {
  chromium: "🌐 Chromium",
  webkit: "🍎 WebKit",
  firefox: "🦊 Firefox",
};
const displayName = (browser: string) => displayNames[browser] ?? browser;
const plainName = (browser: string) => displayName(browser).replace(/^\S+ /, "");

/** Draws a box: the title, then each detail on its own branch. */
const box = (title: string, details: string[]) => [
  `┌─ ${title}`,
  ...details.map((detail, index) => `${index === details.length - 1 ? "└─" : "├─"} 👉 ${detail}`),
];

/** Lines for the base browser's screenshot. Empty when the screenshot wasn't saved. */
export const formatBaseResult = (base: string, screenshotPath: string | null | undefined) =>
  screenshotPath ? box(`${displayName(base)} (base)`, [`Screenshot stored at ${screenshotPath}`]) : [];

export const formatResult = (base: string, comparison: DiffComparison, screenshotPath?: string | null) => {
  const details = [
    `${comparison.pixelChangePercentage.toFixed(2)}% pixel change compared to ${plainName(base)} (${comparison.pixelChange}px)`,
  ];
  if (screenshotPath) details.push(`Screenshot stored at ${screenshotPath}`);
  if (comparison.diffPath) details.push(`Visual diff stored at ${comparison.diffPath}`);
  return box(displayName(comparison.browser), details);
};

/** The decorated results for a terminal: a box per browser, with emoji. */
export const formatDiffDecorated = ({ base, screenshots, comparisons }: DiffResult) => [
  ...formatBaseResult(base, screenshots[base]),
  ...comparisons.flatMap((comparison) => formatResult(base, comparison, screenshots[comparison.browser])),
];

/** One line per comparison: browser, percentage, pixel count and, when saved, the diff path. */
export const formatDiffPlain = ({ comparisons }: DiffResult) =>
  comparisons.map((comparison) =>
    [
      comparison.browser,
      `${comparison.pixelChangePercentage.toFixed(2)}%`,
      `${comparison.pixelChange}px`,
      comparison.diffPath,
    ]
      .filter(Boolean)
      .join(" "),
  );

const size = ({ width, height }: Size) => `${width}x${height}`;

/** One line per browser: the browser and the absolute path of its baseline image. */
export const formatSnapshotPlain = ({ baselines }: SnapshotResult) =>
  Object.entries(baselines).map(([browser, file]) => `${browser} ${file}`);

export const formatSnapshotDecorated = ({ name, baselines }: SnapshotResult) =>
  Object.entries(baselines).flatMap(([browser, file]) =>
    box(displayName(browser), [`Baseline ${JSON.stringify(name)} stored at ${file}`]),
  );

/**
 * One line per browser: browser, percentage, pixel count, before and after size,
 * `same-size` or `size-changed`, and the diff path.
 */
export const formatComparePlain = ({ comparisons }: CompareResult) =>
  comparisons.map((comparison) =>
    [
      comparison.browser,
      `${comparison.pixelChangePercentage.toFixed(2)}%`,
      `${comparison.pixelChange}px`,
      `${size(comparison.before)}->${size(comparison.after)}`,
      comparison.sizeChanged ? "size-changed" : "same-size",
      comparison.diffPath,
    ].join(" "),
  );

export const formatCompareDecorated = ({ comparisons }: CompareResult) =>
  comparisons.flatMap((comparison) =>
    box(displayName(comparison.browser), [
      `${comparison.pixelChangePercentage.toFixed(2)}% pixel change compared to the baseline (${comparison.pixelChange}px)`,
      `Size ${size(comparison.before)} before, ${size(comparison.after)} after (${comparison.sizeChanged ? "changed: the added area counts as changed" : "unchanged"})`,
      `Before stored at ${comparison.beforePath}`,
      `After stored at ${comparison.afterPath}`,
      `Visual diff stored at ${comparison.diffPath}`,
    ]),
  );

/** The deleted folder, if any. */
export const formatClean = ({ removed }: CleanResult) => (removed ? [removed] : []);

/** The result as one JSON document. */
export const formatJson = (result: object) => [JSON.stringify(result, null, 2)];
