#!/usr/bin/env node
import cac from "cac";
import { isUrl } from "./utils";
import { diff } from "./diff";
import { version } from "../package.json";
import { createChromascopeContext } from "./chromascope-context";
import logger from "./logger";

const cli = cac();

cli
  .command(
    "diff <url>",
    "Diff the URL in chromium, firefox, and webkit. Using chromium as the base."
  )
  .option("-v, --verbose", "Show more output")
  .action(async (url: string, options) => {
    if (!url || !isUrl(url)) {
      console.error("Please provide a valid url");
      process.exit(1);
    }

    const ctx = createChromascopeContext(options);
    logger.setOptions({ verbose: options.verbose });

    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }

    logger.debug(`Diffing URL: ${url}`);
    logger.debug(`Run ID: ${ctx.runId}`);

    const result = await diff(url, ctx);
    if (result) process.exit(0);
    process.exit(1);
  });

cli.help();
cli.version(version);
async () => {
  try {
    cli.parse(process.argv, { run: false });

    await cli.runMatchedCommand();
  } catch (error) {
    console.error("Error running command: ", error);
    process.exit(1);
  }
};
