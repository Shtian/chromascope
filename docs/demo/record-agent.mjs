// Records docs/agent-demo.gif: a coding agent highlights one pricing card, sees in the diff that its CSS hit every card,
// fixes the selector and checks again. The snapshot and both compares are real runs of the built CLI against
// site/index.html; agent.html plays their output frame by frame.
// Usage: pnpm build && node docs/demo/record-agent.mjs (needs ffmpeg on PATH)
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
const work = mkdtempSync(join(tmpdir(), "chromascope-agent-demo-"));
const baselineDir = join(work, "baselines");

// The page before the change, and the agent's two attempts at highlighting the Pro card.
const before = readFileSync(join(here, "site", "index.html"), "utf8").replace(
  '<div class="card"><h2>Pro',
  '<div class="card pro"><h2>Pro',
);
const ring = "box-shadow:0 0 0 3px #1f6feb";
const edits = { wrong: `.card{${ring}}`, fixed: `.card.pro{${ring}}` };

let page = before;
const server = createServer((_, res) => res.end(page)).listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const port = server.address().port;
const url = `localhost:${port}`;

// Async, so the server above can answer the browser.
const run = async (...args) => {
  const { stdout } = await promisify(execFile)("node", [
    join(root, "dist", "index.js"),
    ...args,
    "--baseline-dir",
    baselineDir,
  ]);
  return stdout.trim();
};
// Show the output as it would look in the project, served on port 3000, with images in /tmp/pricing.
const shown = (stdout, outDir) =>
  stdout
    .replaceAll(baselineDir, "~/app/.chromascope/baselines")
    .replaceAll(outDir ?? "\0", "/tmp/pricing")
    .replaceAll(`localhost-${port}`, "localhost-3000");

const snapshot = await run("snapshot", url, "--viewport", "1280x450");
const attempts = {};
for (const [name, css] of Object.entries(edits)) {
  page = before.replace("</style>", `${css}</style>`);
  const outDir = join(work, name);
  const stdout = await run("compare", url, "--out", outDir, ...(name === "fixed" ? ["--clean"] : []));
  attempts[name] = {
    css,
    output: shown(stdout, outDir),
    after: pathToFileURL(join(outDir, "after-chromium.png")).href,
    diff: pathToFileURL(join(outDir, "diff-chromium.png")).href,
  };
}
server.close();

const out = join(root, "docs", "agent-demo.gif");
await recordGif(
  join(here, "agent.html"),
  {
    snapshot: shown(snapshot),
    before: pathToFileURL(join(work, "wrong", "before-chromium.png")).href,
    attempts,
  },
  out,
);
rmSync(work, { recursive: true });
console.log(out);
