import type { BrowserName, Size } from "./capture-options";
import type {
  CleanResult,
  CompareComparison,
  CompareResult,
  DiffComparison,
  DiffResult,
  DoctorResult,
  SnapshotResult,
  VersusResult,
} from "./result";

const browserNames: Record<BrowserName, string> = { chromium: "Chromium", webkit: "WebKit", firefox: "Firefox" };
const browserIcons: Record<BrowserName, string> = { chromium: "🌐", webkit: "🍎", firefox: "🦊" };
const decoratedName = (browser: BrowserName) => `${browserIcons[browser]} ${browserNames[browser]}`;

const percent = (percentage: number) => `${percentage.toFixed(2)}%`;

/** Draws a box: the title, then each detail on its own branch. */
const box = (title: string, details: string[]) => [
  `┌─ ${title}`,
  ...details.map((detail, index) => `${index === details.length - 1 ? "└─" : "├─"} 👉 ${detail}`),
];

/** Lines for the base browser's screenshot. Empty when the screenshot wasn't saved. */
export const formatBaseResult = (base: BrowserName, screenshotPath: string | null | undefined) =>
  screenshotPath ? box(`${decoratedName(base)} (base)`, [`Screenshot stored at ${screenshotPath}`]) : [];

export const formatResult = (base: BrowserName, comparison: DiffComparison, screenshotPath?: string | null) => {
  const details = [
    `${percent(comparison.pixelChangePercentage)} pixel change compared to ${browserNames[base]} (${comparison.pixelChange}px)`,
  ];
  if (screenshotPath) details.push(`Screenshot stored at ${screenshotPath}`);
  if (comparison.diffPath) details.push(`Visual diff stored at ${comparison.diffPath}`);
  return box(decoratedName(comparison.browser), details);
};

/** The decorated results for a terminal: a box per browser, with emoji. */
export const formatDiffDecorated = ({ base, screenshots, comparisons }: DiffResult) => [
  ...formatBaseResult(base, screenshots[base]),
  ...comparisons.flatMap((comparison) => formatResult(base, comparison, screenshots[comparison.browser])),
];

/** One line per comparison: browser, percentage, pixel count and, when saved, the diff path. */
export const formatDiffPlain = ({ comparisons }: DiffResult) =>
  comparisons.map((comparison) =>
    [comparison.browser, percent(comparison.pixelChangePercentage), `${comparison.pixelChange}px`, comparison.diffPath]
      .filter(Boolean)
      .join(" "),
  );

const size = ({ width, height }: Size) => `${width}x${height}`;

/** One line per browser: the browser and the absolute path of its baseline image. */
export const formatSnapshotPlain = ({ options, baselines }: SnapshotResult) =>
  options.browsers.map((browser) => `${browser} ${baselines[browser]}`);

export const formatSnapshotDecorated = ({ name, options, baselines }: SnapshotResult) =>
  options.browsers.flatMap((browser) =>
    box(decoratedName(browser), [`Baseline ${JSON.stringify(name)} stored at ${baselines[browser]}`]),
  );

/**
 * One line per browser: browser, percentage, pixel count, before and after size,
 * `same-size` or `size-changed`, and the diff path.
 */
export const formatComparePlain = ({ comparisons }: { comparisons: CompareComparison[] }) =>
  comparisons.map((comparison) =>
    [
      comparison.browser,
      percent(comparison.pixelChangePercentage),
      `${comparison.pixelChange}px`,
      `${size(comparison.before)}->${size(comparison.after)}`,
      comparison.sizeChanged ? "size-changed" : "same-size",
      comparison.diffPath,
    ].join(" "),
  );

/** A box per browser with the change compared to `beforeLabel`, the sizes, and the before, after and diff images. */
const formatBeforeAfterDecorated = (comparisons: CompareComparison[], beforeLabel: string) =>
  comparisons.flatMap((comparison) =>
    box(decoratedName(comparison.browser), [
      `${percent(comparison.pixelChangePercentage)} pixel change compared to ${beforeLabel} (${comparison.pixelChange}px)`,
      `Size ${size(comparison.before)} before, ${size(comparison.after)} after (${comparison.sizeChanged ? "changed: the added area counts as changed" : "unchanged"})`,
      `Before stored at ${comparison.beforePath}`,
      `After stored at ${comparison.afterPath}`,
      `Visual diff stored at ${comparison.diffPath}`,
    ]),
  );

export const formatCompareDecorated = ({ comparisons }: CompareResult) =>
  formatBeforeAfterDecorated(comparisons, "the baseline");

/** The same line per browser as `compare`. */
export const formatVersusPlain = formatComparePlain;

export const formatVersusDecorated = ({ comparisons, beforeUrl }: VersusResult) =>
  formatBeforeAfterDecorated(comparisons, beforeUrl);

/** One line per check: `ok` or `fail`, the check name and message, and the fix for a failed check. */
export const formatDoctorPlain = ({ checks }: DoctorResult) =>
  checks.map(({ name, ok, message, fix }) => `${ok ? "ok" : "fail"} ${name}: ${message}${fix ? ` (fix: ${fix})` : ""}`);

export const formatDoctorDecorated = ({ checks }: DoctorResult) =>
  checks.map(({ ok, message, fix }) => `${ok ? "✔" : "✖"} ${message}${fix ? `\n  👉 ${fix}` : ""}`);

/** The deleted folder, if any. */
export const formatClean = ({ removed }: CleanResult) => (removed ? [removed] : []);

/** The result as one JSON document. */
export const formatJson = (result: object) => [JSON.stringify(result, null, 2)];
