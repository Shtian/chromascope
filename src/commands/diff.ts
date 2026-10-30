import type { BrowserName, CaptureOptions } from "../lib/capture-options";
import type { Capturer } from "../lib/capturer";
import { runComparison } from "../lib/comparison-run";
import type { DiffResult } from "../lib/result";
import type { RunFolderOptions } from "../lib/run";

export type DiffOptions = {
  capture: CaptureOptions;
  /** The browser every other browser is compared against. Always captured, and listed first in the result. */
  base: BrowserName;
  threshold: number;
  /** Exit `1` when a comparison's pixel change percentage is above this. `null` never fails. */
  failAbove: number | null;
  saveDiff: boolean;
  run: RunFolderOptions;
};

/**
 * Runs a cross-browser diff: captures the page in every browser and compares each against the base browser.
 * Screenshots and diffs are written to the run folder with `--save-diff` or `--out`, once every capture succeeded.
 * Resolves to the result and whether a comparison is above `--fail-above`.
 */
export const diff = async (url: string, options: DiffOptions, capturer: Capturer) => {
  const { base } = options;
  const { result, aboveFailAbove } = await runComparison(
    {
      ...options,
      command: "diff",
      fields: { url, base },
      url,
      before: { kind: "base-browser", base, save: options.saveDiff },
    },
    capturer,
  );
  return { result: result satisfies DiffResult, aboveFailAbove };
};
