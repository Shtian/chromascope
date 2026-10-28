#!/usr/bin/env node
import cac, { type Command } from "cac";
import { version } from "../package.json";
import { diff, printResults } from "./commands/diff";
import { createChromascopeContext } from "./context";
import { type CaptureFlags, parseBase, parseCaptureOptions } from "./lib/capture-options";
import { installBrowsers } from "./lib/install";
import logger from "./lib/logger";
import spinner from "./lib/spinner";
import { normalizeUrl, parseThreshold } from "./lib/utils";

const cli = cac("chromascope");

/** Adds the capture option flags shared by every command that captures a page. */
const withCaptureOptions = (command: Command, { browsers }: { browsers: string }) =>
  command
    .option("--browsers <list>", `Comma separated browsers to capture (default: ${browsers})`)
    .option("-e, --element <selector>", "Capture only the element with the given selector")
    .option("-f, --full-page", "Take a full page screenshot")
    .option("--viewport <size>", "Viewport size as <width>x<height> (default: 1280x720)")
    .option("--device-scale-factor <n>", "Device scale factor, like 2 for retina screenshots (default: 1)")
    .option("--timeout <ms>", "Milliseconds each navigation, wait and capture may take (default: 30000)")
    .option("--wait-for <selector>", "Wait for the selector to be visible before capturing")
    .option(
      "--wait-until <event>",
      "Page load event to wait for: load, domcontentloaded or networkidle (default: load)",
    )
    .option("-c, --cookie <cookie>", "Add one or more cookies to the context. Format: key=value;key2=value2");

withCaptureOptions(
  cli.command("diff <url>", "Capture the URL in several browsers and compare each against the base browser"),
  { browsers: "chromium,webkit,firefox" },
)
  .option("--base <browser>", "Browser the others are compared against", { default: "chromium" })
  .option("-v, --verbose", "Show more output")
  .option("-s, --save-diff", "Save the screenshots and diffs as png in a new run folder inside --folder")
  .option("-t, --threshold <threshold>", "Set the threshold for the diff", {
    default: 0.2,
  })
  .option("-o, --folder <folder>", "Set the base folder for chromascope runs", {
    default: "chromascope-runs",
  })
  .option("--out <dir>", "Save the screenshots and diffs as png in exactly this folder, without a run folder")
  .action(async (url: string, options: CaptureFlags & Record<string, unknown>) => {
    spinner.start("Starting ⚙️");
    const normalizedUrl = normalizeUrl(url ?? "");
    if (!normalizedUrl) {
      spinner.fail();
      console.error("Please provide a valid url");
      process.exit(1);
    }
    const capture = parseCaptureOptions(options, { browsers: ["chromium", "webkit", "firefox"] });
    const ctx = createChromascopeContext(
      {
        ...capture,
        ...parseBase(options.base, capture.browsers),
        verbose: Boolean(options.verbose),
        threshold: parseThreshold(options.threshold),
        folder: String(options.folder),
        out: options.out === undefined ? undefined : String(options.out),
        saveDiff: Boolean(options.saveDiff),
      },
      spinner,
    );

    logger.setOptions({ verbose: ctx.options.verbose });
    logger.debug(`Options provided: ${JSON.stringify(options)}`);

    logger.debug(`Diffing URL: ${normalizedUrl}`);
    logger.debug(`Run ID: ${ctx.runId}`);

    if (ctx.saveArtifacts) logger.debug(`Run folder: ${ctx.runFolder}`);

    const result = await diff(normalizedUrl, ctx);
    spinner.succeed("Diff complete 🎉");
    printResults(result);
  });

cli.command("install", "Install the chromium, firefox, and webkit browsers used by chromascope").action(async () => {
  process.exitCode = await installBrowsers();
});

cli.help();
cli.version(version);

(async () => {
  try {
    cli.parse(process.argv, { run: false });
    await cli.runMatchedCommand();
  } catch (error) {
    spinner.fail("Failed");
    logger.error(error instanceof Error ? error.message : error);
    logger.debug(error);
    process.exit(1);
  }
})();
