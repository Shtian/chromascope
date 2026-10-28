import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";

const BIN = path.join(import.meta.dirname, "../dist/index.js");

export type CliRun = { code: number | null; stdout: string; stderr: string };

const collect = (child: ChildProcessWithoutNullStreams) =>
  new Promise<CliRun>((resolve, reject) => {
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

/** Runs the built CLI in `cwd`, without a terminal, so runs never write to the repo. */
export const runCli = (cwd: string, ...args: string[]) =>
  collect(spawn(process.execPath, [BIN, ...args], { cwd, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } }));

/**
 * Runs a shell command line, like a hint printed by chromascope, in `cwd`, without a terminal.
 * `chromascope` in the command runs the built CLI.
 */
export const runShell = (cwd: string, command: string) =>
  collect(
    spawn("/bin/sh", ["-c", `chromascope() { "$CHROMASCOPE_NODE" "$CHROMASCOPE_BIN" "$@"; }\n${command}`], {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        CHROMASCOPE_NODE: process.execPath,
        CHROMASCOPE_BIN: BIN,
      },
    }),
  );
