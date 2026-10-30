import type { CaptureOptions } from "../lib/capture-options";
import type { Capturer } from "../lib/capturer";
import { runComparison } from "../lib/comparison-run";
import output from "../lib/output";
import type { VersusResult } from "../lib/result";
import type { RunFolderOptions } from "../lib/run";

export type VersusOptions = {
  beforeUrl: string;
  afterUrl: string;
  /** The capture options for both URLs. `cookie` is set for whichever URL is captured. */
  capture: CaptureOptions;
  threshold: number;
  failAbove: number | null;
  run: RunFolderOptions;
};

/**
 * Runs a URL comparison: captures both URLs in each browser and compares each browser's capture of the after URL
 * against its capture of the before URL. Never reads or writes baselines.
 * Resolves to the result and whether a comparison is above `--fail-above`.
 */
export const versus = async (options: VersusOptions, capturer: Capturer) => {
  const { beforeUrl, afterUrl } = options;
  output.debug(`Comparing ${afterUrl} against ${beforeUrl}`);
  const { result, aboveFailAbove } = await runComparison(
    {
      ...options,
      command: "versus",
      fields: { beforeUrl, afterUrl },
      url: afterUrl,
      before: { kind: "url", url: beforeUrl },
    },
    capturer,
  );
  return { result: result satisfies VersusResult, aboveFailAbove };
};
