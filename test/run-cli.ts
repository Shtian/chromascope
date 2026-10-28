import { spawn } from "node:child_process";
import path from "node:path";

const BIN = path.join(import.meta.dirname, "../dist/index.js");

export type CliRun = { code: number | null; stdout: string; stderr: string };

/** Runs the built CLI in `cwd`, without a terminal, so runs never write to the repo. */
export const runCli = (cwd: string, ...args: string[]) =>
  new Promise<CliRun>((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
