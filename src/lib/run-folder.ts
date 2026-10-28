import fs from "node:fs";
import path from "node:path";
import type { ChromascopeContext } from "../context";

/**
 * Creates the folder the run writes its artifacts to. `--out` folders may already exist and are reused.
 * Run folders inside `--folder` are created exclusively, so a run ID collision fails instead of overwriting another run.
 */
export const createRunFolder = ({ runFolder, options }: Pick<ChromascopeContext, "runFolder" | "options">) => {
  if (options.out) {
    fs.mkdirSync(runFolder, { recursive: true });
    return;
  }
  fs.mkdirSync(path.dirname(runFolder), { recursive: true });
  fs.mkdirSync(runFolder);
};
