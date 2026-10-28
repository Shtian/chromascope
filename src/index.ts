#!/usr/bin/env node
import cac, { type Command } from "cac";
import { version } from "../package.json";
import { diff } from "./commands/diff";
import { createChromascopeContext } from "./context";
import { type CaptureFlags, parseBase, parseCaptureOptions } from "./lib/capture-options";
import { EXIT_CODES, exitCodeFor, formatError, toChromascopeError, toErrorResult, usageError } from "./lib/errors";
import { formatDiffDecorated, formatDiffPlain, formatJson } from "./lib/format";
import { installBrowsers } from "./lib/install";
import output from "./lib/output";
import { isAboveFailAbove, parseFailAbove, parseThreshold, parseUrl } from "./lib/utils";

type Flags = CaptureFlags & Record<string, unknown>;

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

/** Adds the flags that control output, shared by every command that prints a result. */
const withOutputOptions = (command: Command) =>
  command
    .option("-v, --verbose", "Print debug output on stderr")
    .option("-q, --quiet", "Print no progress on stderr. Errors still print")
    .option("--json", "Print the result, or the error, as one JSON document on stdout");

const configureOutput = (options: Flags) =>
  output.configure({ verbose: Boolean(options.verbose), quiet: Boolean(options.quiet), json: Boolean(options.json) });

withOutputOptions(
  withCaptureOptions(
    cli.command("diff <url>", "Capture the URL in several browsers and compare each against the base browser"),
    { browsers: "chromium,webkit,firefox" },
  ),
)
  .option("--base <browser>", "Browser the others are compared against", { default: "chromium" })
  .option("-t, --threshold <threshold>", "Set the threshold for the diff", {
    default: 0.2,
  })
  .option("--fail-above <percent>", "Exit with 1 when a browser's pixel change is above this percentage")
  .option("-s, --save-diff", "Save the screenshots and diffs as png in a new run folder inside --folder")
  .option("-o, --folder <folder>", "Set the base folder for chromascope runs", {
    default: "chromascope-runs",
  })
  .option("--out <dir>", "Save the screenshots and diffs as png in exactly this folder, without a run folder")
  .action(async (url: string, options: Flags) => {
    configureOutput(options);
    const normalizedUrl = parseUrl(url);
    const capture = parseCaptureOptions(options, { browsers: ["chromium", "webkit", "firefox"] });
    const ctx = createChromascopeContext({
      ...capture,
      ...parseBase(options.base, capture.browsers),
      verbose: Boolean(options.verbose),
      threshold: parseThreshold(options.threshold),
      failAbove: options.failAbove === undefined ? null : parseFailAbove(options.failAbove),
      folder: String(options.folder),
      out: options.out === undefined ? undefined : String(options.out),
      saveDiff: Boolean(options.saveDiff),
    });

    output.debug(`Options provided: ${JSON.stringify(options)}`);
    output.debug(`Diffing URL: ${normalizedUrl}`);
    output.debug(`Run ID: ${ctx.runId}`);
    if (ctx.saveArtifacts) output.debug(`Run folder: ${ctx.runFolder}`);

    const result = await diff(normalizedUrl, ctx);
    output.info("Diff complete", "🎉");
    output.result(
      output.json ? formatJson(result) : output.plain ? formatDiffPlain(result) : formatDiffDecorated(result),
    );

    const percentages = result.comparisons.map((comparison) => comparison.pixelChangePercentage);
    if (!isAboveFailAbove(percentages, ctx.options.failAbove)) return EXIT_CODES.ok;
    output.info(`Pixel change above --fail-above ${ctx.options.failAbove}%`);
    return EXIT_CODES.aboveFailAbove;
  });

cli
  .command("install", "Install the chromium, firefox, and webkit browsers used by chromascope")
  .action(() => installBrowsers());

cli.help((sections) => [
  ...sections,
  {
    title: "Exit codes",
    body: [
      "  0  Success: every comparison is within --fail-above, or no --fail-above was given",
      "  1  At least one comparison is above --fail-above",
      "  2  Usage error: unknown command or option, missing or invalid argument",
      "  3  Runtime error: navigation failed, selector not found, timeout, browser missing",
    ].join("\n"),
  },
  {
    title: "Error codes",
    body: [
      "  Usage (exit 2):   INVALID_URL, INVALID_OPTION, INVALID_ARGUMENT, MISSING_ARGUMENT, UNKNOWN_COMMAND,",
      "                    INVALID_SELECTOR",
      "  Runtime (exit 3): BROWSER_NOT_INSTALLED, NAVIGATION_FAILED, SELECTOR_TIMEOUT, UNKNOWN_ERROR",
    ].join("\n"),
  },
]);
cli.version(version);

/** Parses the arguments and runs the command. Resolves to the exit code. */
const run = async (): Promise<number> => {
  cli.parse(process.argv, { run: false });
  if (!cli.matchedCommand && cli.args.length > 0) {
    throw usageError(
      "UNKNOWN_COMMAND",
      `unknown command ${JSON.stringify(cli.args[0])}`,
      "run chromascope --help to see the commands",
    );
  }
  return (await cli.runMatchedCommand()) ?? EXIT_CODES.ok;
};

/** The only place that turns an error into output and an exit code. */
const handleError = (thrown: unknown) => {
  const error = toChromascopeError(thrown);
  // Parsing may fail before a command configured the output, so look for the flags directly.
  if (process.argv.includes("--json")) output.configure({ json: true });
  if (process.argv.includes("--verbose")) output.configure({ verbose: true });
  if (output.json) output.result(formatJson(toErrorResult(error)));
  output.error(formatError(error).join("\n"));
  output.debug(error.cause ?? error);
  return exitCodeFor(error);
};

process.exitCode = await run().catch(handleError);
