// Shared by the demo recorders: plays a player page frame by frame and encodes the frames as a GIF with ffmpeg.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const fps = 15;

/**
 * Opens `player` (an HTML file that defines window.DURATION and window.render(t)),
 * sets window.DEMO to `demo`, renders every frame and writes the GIF to `out`.
 */
export async function recordGif(player, demo, out) {
  const framesDir = mkdtempSync(join(tmpdir(), "chromascope-frames-"));
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 960, height: 560 } });
  await tab.goto(pathToFileURL(player).href);
  await tab.evaluate((value) => {
    window.DEMO = value;
  }, demo);

  const duration = await tab.evaluate(() => window.DURATION);
  for (let frame = 0; frame * (1000 / fps) < duration; frame++) {
    await tab.evaluate((t) => window.render(t), frame * (1000 / fps));
    await tab.waitForFunction(() => [...document.images].every((img) => img.complete));
    await tab.screenshot({ path: join(framesDir, `${String(frame).padStart(4, "0")}.png`) });
  }
  await browser.close();

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
  rmSync(framesDir, { recursive: true });
}
