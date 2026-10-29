import crypto from "node:crypto";
import path from "node:path";
import type { BrowserName, CaptureOptions } from "./lib/capture-options";

/** Where a run writes its artifacts: a new run folder inside `folder`, or exactly `out`. */
export type RunFolderOptions = { folder: string; out?: string };

export type ChromascopeOptions = CaptureOptions &
  RunFolderOptions & {
    /** The browser every other browser is compared against. Always the first of `browsers`. */
    base: BrowserName;
    verbose: boolean;
    threshold: number;
    /** Exit `1` when a comparison's pixel change percentage is above this. `null` never fails. */
    failAbove: number | null;
    saveDiff: boolean;
  };

export type ChromascopeContext = {
  runId: string;
  /** Absolute path of the folder the artifacts are written to. */
  runFolder: string;
  /** Whether screenshots and diffs are written to `runFolder`: with `--save-diff` or `--out`. */
  saveArtifacts: boolean;
  options: ChromascopeOptions;
};

/** A new run ID and the absolute path of the run's folder, without creating it: `--out`, or a folder named after the run ID in `--folder`. */
export const resolveRun = ({ folder, out }: RunFolderOptions) => {
  const runId = createRunId();
  return { runId, runFolder: out ? path.resolve(out) : path.resolve(folder, runId) };
};

export function createChromascopeContext(options: ChromascopeOptions) {
  const { runId, runFolder } = resolveRun(options);
  const ctx: ChromascopeContext = {
    runId,
    runFolder,
    saveArtifacts: options.saveDiff || Boolean(options.out),
    options,
  };

  return ctx;
}

/** The local date and time to the second, plus a random suffix so runs started in the same second don't collide. */
export const createRunId = (now = new Date()) => {
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${year}${month}${day}${hours}${minutes}${seconds}-${suffix}`;
};
