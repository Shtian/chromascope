#!/usr/bin/env node
import cac from "cac";
import { isUrl } from "./utils";
const cli = cac();

cli
  .command("diff <link>", "Diff the url in various browsers")
  .action((link: string) => {
    if (!link || !isUrl(link)) {
      console.error("Please provide a valid url");
      process.exit(1);
    }

    if (!link.startsWith("http")) {
      link = `https://${link}`;
    }

    console.log(link);
  });

cli.help();
cli.parse();
