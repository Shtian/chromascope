#!/usr/bin/env node
import cac from "cac";
import { isUrl } from "./utils";
import { DiffResult, diff } from "./diff";
import { version } from "../package.json";
import { createChromascopeContext } from "./context";
import logger from "./logger";
import spinner from "./spinner";

const cli = cac("chromascope");

cli
  .command("diff <url>", "Diff the URL in chromium, firefox, and webkit. Using chromium as the base.")
  .option("-e, --element <selector>", "Diff only the element with the given selector")
  .option("-f, --full-page", "Take a full page screenshot")
  .option("-v, --verbose", "Show more output")
  .option("-s, --save-diff", "Save generated diff as png")
  .option("-t, --threshold <threshold>", "Set the threshold for the diff", {
    default: 0.2,
  })
  .option("-f, --folder <folder>", "Set the base folder for chromascope runs", {
    default: "chromascope-runs",
  })
  // TODO: Add option to configure browser dimensions
  // TODO: Add option for mobile browsers
  // rome-ignore lint/suspicious/noExplicitAny: <explanation>
  .action(async (url: string, options: any) => {
    spinner.start("Starting ⚙️");
    if (!url || !isUrl(url)) {
      spinner.fail();
      console.error("Please provide a valid url");
      process.exit(1);
    }
    const ctx = createChromascopeContext(options, spinner);

    logger.setOptions({ verbose: options.verbose });
    logger.debug(`Options provided: ${JSON.stringify(options)}`);

    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }

    logger.debug(`Diffing URL: ${url}`);
    logger.debug(`Run ID: ${ctx.runId}`);

    const result = await diff(url, ctx);
    spinner.succeed("Diff complete 🎉");
    result.forEach(printResults);

    process.exit(0);
  });

const printResults = (res: DiffResult) => {
  logger.log(`┌─ ${res.browserName}`);
  logger.log(
    `${res.diffPath ? "├─" : "└─"} 👉 ${res.pixelChangePercentage.toFixed(2)}% pixel change compared to Chromium (${
      res.pixelChange
    }px)`,
  );
  if (res.diffPath) logger.log(`└─ 👉 Visual diff stored at ${res.diffPath}`);
};

cli.help();
cli.version(version);

(async () => {
  try {
    cli.parse(process.argv, { run: false });

    await cli.runMatchedCommand();
  } catch (error) {
    spinner.fail("Failed");
    logger.error("Error running command: ", error);
    process.exit(1);
  }
})();
