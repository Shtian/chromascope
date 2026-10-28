import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const browsers = ["chromium", "firefox", "webkit"];

/** Runs `playwright install` for the browsers chromascope uses. Resolves with the exit code. */
export const installBrowsers = () => {
  const require = createRequire(import.meta.url);
  const playwrightCli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");

  return new Promise<number>((resolve, reject) => {
    spawn(process.execPath, [playwrightCli, "install", ...browsers], { stdio: "inherit" })
      .on("error", reject)
      .on("close", (code) => resolve(code ?? 1));
  });
};
