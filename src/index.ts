#!/usr/bin/env node
import cac from "cac";
import { isUrl } from "./utils";
import { diff } from "./diff";
import { version } from "../package.json";
import { createChromascopeContext } from "./context";
import logger from "./logger";
import spinner from "./spinner";

const cli = cac();

cli
  .command(
    "diff <url>",
    "Diff the URL in chromium, firefox, and webkit. Using chromium as the base."
  )
  .option("-v, --verbose", "Show more output")
  .option("-s, --save-diff", "Save generated diff as png")
  .option("-t, --threshold <threshold>", "Set the threshold for the diff", {
    default: 0.1,
  })
  .option("-f, --folder <folder>", "Set the base folder for chromascope runs", {
    default: "chromascope-runs",
  })
  .action(async (url: string, options) => {
    spinner.start("Starting ⚙️");
    if (!url || !isUrl(url)) {
      spinner.fail();
      console.error("Please provide a valid url");
      process.exit(1);
    }

    const ctx = createChromascopeContext(options, spinner);
    logger.setOptions({ verbose: options.verbose });

    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }

    logger.debug(`Diffing URL: ${url}`);
    logger.debug(`Run ID: ${ctx.runId}`);

    const result = await diff(url, ctx);
    spinner.succeed();
    logger.log("Diff Results:");
    logger.log(JSON.stringify(result));

    process.exit(0);
  });

cli.help();
cli.version(version);

(async () => {
  try {
    cli.parse(process.argv, { run: false });

    await cli.runMatchedCommand();
  } catch (error) {
    spinner.fail();
    logger.error("Error running command: ", error);
    process.exit(1);
  }
})();
