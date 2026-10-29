// Records docs/demo.gif: runs the built CLI against site/index.html in every browser,
// then plays terminal.html with the real results frame by frame and encodes the frames with ffmpeg.
// Usage: pnpm build && node docs/demo/record.mjs (needs ffmpeg on PATH)
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { recordGif } from "./frames.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..", "..");
const work = mkdtempSync(join(tmpdir(), "chromascope-demo-"));

const page = readFileSync(join(here, "site", "index.html"));
const server = createServer((_, res) => res.end(page)).listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const url = `localhost:${server.address().port}`;

const shotsDir = join(work, "shots");
// Async, so the server above can answer the browsers.
const { stdout } = await promisify(execFile)("node", [
  join(root, "dist", "index.js"),
  "diff",
  url,
  "--viewport",
  "1280x450",
  "--json",
  "--out",
  shotsDir,
]);
const result = JSON.parse(stdout);
server.close();

const out = join(root, "docs", "demo.gif");
await recordGif(
  join(here, "terminal.html"),
  {
    runId: result.runId,
    comparisons: result.comparisons,
    shots: {
      chromium: pathToFileURL(result.screenshots.chromium).href,
      firefox: pathToFileURL(result.screenshots.firefox).href,
      diff: pathToFileURL(result.comparisons.find((c) => c.browser === "firefox").diffPath).href,
    },
  },
  out,
);
rmSync(work, { recursive: true });
console.log(out);
