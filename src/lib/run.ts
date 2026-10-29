import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Where a run writes its artifacts: a new run folder inside `folder`, or exactly `out`. */
export type RunFolderOptions = { folder: string; out?: string };

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

/**
 * Starts a run: a new run ID and the absolute path of its folder, `--out` or a folder named after the run ID in
 * `--folder`. Nothing is created until the first artifact is written, so a run that fails before then leaves nothing
 * behind. `--out` folders may already exist and are reused. Run folders inside `--folder` are created exclusively, so a
 * run ID collision fails instead of overwriting another run.
 */
export const openRun = ({ folder, out }: RunFolderOptions) => {
  const runId = createRunId();
  const dir = out ? path.resolve(out) : path.resolve(folder, runId);
  let created = false;

  const create = () => {
    if (out) {
      fs.mkdirSync(dir, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      fs.mkdirSync(dir);
    }
    created = true;
  };

  return {
    runId,
    /** Absolute path of the folder the artifacts are written to. */
    dir,
    /** Absolute path of the artifact with this file name. */
    pathOf: (name: string) => path.join(dir, name),
    /** Writes the artifact, creating the run folder first if needed, and returns its absolute path. */
    write(name: string, data: Buffer) {
      if (!created) create();
      const file = path.join(dir, name);
      fs.writeFileSync(file, data);
      return file;
    },
  };
};

export type Run = ReturnType<typeof openRun>;
