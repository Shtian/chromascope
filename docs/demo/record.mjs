// Records docs/demo.gif: runs the built CLI against site/index.html in every browser,
// then plays terminal.html with the real results frame by frame and encodes the frames with ffmpeg.
// Usage: pnpm build && node docs/demo/record.mjs (needs ffmpeg on PATH)
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..", "..");
const fps = 15;
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

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 960, height: 560 } });
await tab.goto(pathToFileURL(join(here, "terminal.html")).href);
await tab.evaluate(
  (demo) => {
    window.DEMO = demo;
  },
  {
    runId: result.runId,
    comparisons: result.comparisons,
    shots: {
      chromium: pathToFileURL(result.screenshots.chromium).href,
      firefox: pathToFileURL(result.screenshots.firefox).href,
      diff: pathToFileURL(result.comparisons.find((c) => c.browser === "firefox").diffPath).href,
    },
  },
);

const framesDir = join(work, "frames");
mkdirSync(framesDir);
const duration = await tab.evaluate(() => window.DURATION);
for (let frame = 0; frame * (1000 / fps) < duration; frame++) {
  await tab.evaluate((t) => window.render(t), frame * (1000 / fps));
  await tab.waitForFunction(() => [...document.images].every((img) => img.complete));
  await tab.screenshot({ path: join(framesDir, `${String(frame).padStart(4, "0")}.png`) });
}
await browser.close();

const out = join(root, "docs", "demo.gif");
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-framerate",
  String(fps),
  "-i",
  join(framesDir, "%04d.png"),
  "-vf",
  "split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
  "-loop",
  "0",
  out,
]);
rmSync(work, { recursive: true });
console.log(out);
