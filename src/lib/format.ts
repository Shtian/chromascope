import type { BrowserComparison } from "../commands/diff";

export type DiffRun = {
  base: string;
  /** Absolute path, or `""` when artifacts aren't saved. */
  baseScreenshotPath: string;
  comparisons: BrowserComparison[];
};

type FormattableResult = {
  browser: string;
  pixelChange: number;
  pixelChangePercentage: number;
  diffPath: string;
  screenshotPath: string;
};

const displayNames: Record<string, string> = {
  chromium: "🌐 Chromium",
  webkit: "🍎 WebKit",
  firefox: "🦊 Firefox",
};
const displayName = (browser: string) => displayNames[browser] ?? browser;
const plainName = (browser: string) => displayName(browser).replace(/^\S+ /, "");

/** Lines for the base browser's screenshot. Empty when the screenshot wasn't saved. */
export const formatBaseResult = (base: string, screenshotPath: string) =>
  screenshotPath ? [`┌─ ${displayName(base)} (base)`, `└─ 👉 Screenshot stored at ${screenshotPath}`] : [];

export const formatResult = (base: string, res: FormattableResult) => {
  const details = [
    `👉 ${res.pixelChangePercentage.toFixed(2)}% pixel change compared to ${plainName(base)} (${res.pixelChange}px)`,
  ];
  if (res.screenshotPath) details.push(`👉 Screenshot stored at ${res.screenshotPath}`);
  if (res.diffPath) details.push(`👉 Visual diff stored at ${res.diffPath}`);
  return [
    `┌─ ${displayName(res.browser)}`,
    ...details.map((detail, index) => `${index === details.length - 1 ? "└─" : "├─"} ${detail}`),
  ];
};

/** The decorated results for a terminal: a box per browser, with emoji. */
export const formatDiffDecorated = ({ base, baseScreenshotPath, comparisons }: DiffRun) => [
  ...formatBaseResult(base, baseScreenshotPath),
  ...comparisons.flatMap((comparison) => formatResult(base, comparison)),
];

/** One line per comparison: browser, percentage, pixel count and, when saved, the diff path. */
export const formatDiffPlain = ({ comparisons }: DiffRun) =>
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
