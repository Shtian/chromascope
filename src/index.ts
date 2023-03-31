#!/usr/bin/env node
import cac from "cac";

const cli = cac();

cli.command("<link>", "Diff the url in various browsers").action((link) => {
  console.log(link);
});
