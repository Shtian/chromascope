import crypto from "node:crypto";
import path from "node:path";
import type { Ora } from "ora";

export type ChromascopeOptions = {
  verbose: boolean;
  threshold: number;
  folder: string;
  out?: string;
  saveDiff: boolean;
  element: string;
  fullPage: boolean;
  cookie: string;
};

export type ChromascopeContext = {
  runId: string;
  spinner: Ora;
  /** Absolute path of the folder the artifacts are written to. */
  runFolder: string;
  /** Whether screenshots and diffs are written to `runFolder`: with `--save-diff` or `--out`. */
  saveArtifacts: boolean;
  options: ChromascopeOptions;
};

export function createChromascopeContext(options: ChromascopeOptions, spinner: Ora) {
  const runId = createRunId();
  const runFolder = options.out ? path.resolve(options.out) : path.resolve(options.folder, runId);
  const ctx: ChromascopeContext = {
    runId,
    spinner,
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
