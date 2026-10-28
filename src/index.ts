#!/usr/bin/env node
import cac from "cac";
import { version } from "../package.json";
import { diff, printResults } from "./commands/diff";
import { type ChromascopeOptions, createChromascopeContext } from "./context";
import { installBrowsers } from "./lib/install";
import logger from "./lib/logger";
import spinner from "./lib/spinner";
import { normalizeUrl, parseThreshold } from "./lib/utils";

const cli = cac("chromascope");

cli
  .command("diff <url>", "Diff the URL in chromium, firefox, and webkit. Using chromium as the base.")
  .option("-e, --element <selector>", "Diff only the element with the given selector")
  .option("-f, --full-page", "Take a full page screenshot")
  .option("-v, --verbose", "Show more output")
  .option("-c, --cookie <cookie>", "Add one or more cookies to the context. Format: key=value;key2=value2")
  .option("-s, --save-diff", "Save the screenshots and diffs as png in a new run folder inside --folder")
  .option("-t, --threshold <threshold>", "Set the threshold for the diff", {
    default: 0.2,
  })
  .option("-o, --folder <folder>", "Set the base folder for chromascope runs", {
    default: "chromascope-runs",
  })
  .option("--out <dir>", "Save the screenshots and diffs as png in exactly this folder, without a run folder")
  .action(async (url: string, options: ChromascopeOptions) => {
    spinner.start("Starting ⚙️");
    const normalizedUrl = normalizeUrl(url ?? "");
    if (!normalizedUrl) {
      spinner.fail();
      console.error("Please provide a valid url");
      process.exit(1);
    }
    const ctx = createChromascopeContext({ ...options, threshold: parseThreshold(options.threshold) }, spinner);

    logger.setOptions({ verbose: options.verbose });
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
