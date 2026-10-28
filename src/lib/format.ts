import type { DiffComparison, DiffResult } from "./result";

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

/** The result as one JSON document. */
export const formatJson = (result: object) => [JSON.stringify(result, null, 2)];
