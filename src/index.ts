#!/usr/bin/env node
import cac from "cac";
import { isUrl } from "./utils";
import { v4 as uuid } from "uuid";
import { diff } from "./diff";

const cli = cac();

cli
  .command("diff <link>", "Diff the url in various browsers")
  .option("-v, --verbose", "Show more output")
  .action(async (link: string, options) => {
    if (!link || !isUrl(link)) {
      console.error("Please provide a valid url");
      process.exit(1);
    }
    const { verbose } = options;
    if (!link.startsWith("http")) {
      link = `https://${link}`;
    }

    const runId = uuid();

    if (verbose) {
      console.log(`Diffing URL: ${link}`);
      console.log(`Run ID: ${runId}`);
    }

    const result = await diff(link, { verbose, runId });
    if (result) process.exit(0);
    process.exit(1);
  });

cli.help();
cli.parse();
