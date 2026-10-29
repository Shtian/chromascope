#!/usr/bin/env node
import cac, { type Command } from "cac";
import { chromium, firefox, webkit } from "playwright";
import { version } from "../package.json";
import { compare } from "./commands/compare";
import { diff } from "./commands/diff";
import { snapshot } from "./commands/snapshot";
import { versus } from "./commands/versus";
import { createChromascopeContext } from "./context";
import { createBaselineStore, DEFAULT_BASELINE_DIR, deriveBaselineName, parseBaselineName } from "./lib/baselines";
import {
  BROWSERS,
  type CaptureFlags,
  parseBase,
  parseBrowsers,
  parseCaptureOptions,
  parseImageOptions,
} from "./lib/capture-options";
import { runDoctor } from "./lib/doctor";
import {
  EXIT_CODES,
  exitCodeFor,
  formatError,
  formatErrorCodes,
  toChromascopeError,
  toErrorResult,
  usageError,
} from "./lib/errors";
import { FLAGS } from "./lib/flags";
import {
  formatClean,
  formatCompareDecorated,
  formatComparePlain,
  formatDiffDecorated,
  formatDiffPlain,
  formatDoctorDecorated,
  formatDoctorPlain,
  formatJson,
  formatSnapshotDecorated,
  formatSnapshotPlain,
  formatVersusDecorated,
  formatVersusPlain,
} from "./lib/format";
import { installBrowsers } from "./lib/install";
import output from "./lib/output";
import { type CleanResult, SCHEMA_VERSION } from "./lib/result";
import { parseFailAbove, parseThreshold, parseUrl } from "./lib/utils";

type Flags = CaptureFlags & Record<string, unknown>;

const cli = cac("chromascope");

/**
 * Adds the capture option flags shared by every command that captures a page.
 * `compare` takes the image options from the baseline, so they have no defaults of their own there.
 */
const withCaptureOptions = (command: Command, { browsers, fromBaseline = false }: CaptureDefaults) => {
  const byDefault = (value?: string) =>
    fromBaseline ? " (default: the baseline's)" : value ? ` (default: ${value})` : "";
  return command
    .option(`${FLAGS.browsers} <list>`, `Comma separated browsers to capture (default: ${browsers})`)
    .option(`-e, ${FLAGS.element} <selector>`, `Capture only the element with the given selector${byDefault()}`)
    .option(`-f, ${FLAGS.fullPage}`, `Take a full page screenshot${byDefault()}`)
    .option(`${FLAGS.viewport} <size>`, `Viewport size as <width>x<height>${byDefault("1280x720")}`)
    .option(`${FLAGS.deviceScaleFactor} <n>`, `Device scale factor, like 2 for retina screenshots${byDefault("1")}`)
    .option(`${FLAGS.timeout} <ms>`, "Milliseconds each navigation, wait and capture may take (default: 30000)")
    .option(`${FLAGS.waitFor} <selector>`, `Wait for the selector to be visible before capturing${byDefault()}`)
    .option(
      `${FLAGS.waitUntil} <event>`,
      `Page load event to wait for: load, domcontentloaded or networkidle${byDefault("load")}`,
    )
    .option(`${FLAGS.mask} <selector>`, `Hide the elements matching the selector. Repeat it to mask more${byDefault()}`)
    .option(`-c, ${FLAGS.cookie} <cookie>`, "Add one or more cookies to the context. Format: key=value;key2=value2");
};

type CaptureDefaults = { browsers: string; fromBaseline?: boolean };

/** Adds the flags that control output, shared by every command that prints a result. */
const withOutputOptions = (command: Command) =>
  command
    .option(`-v, ${FLAGS.verbose}`, "Print debug output on stderr")
    .option(`-q, ${FLAGS.quiet}`, "Print no progress on stderr. Errors still print")
    .option(FLAGS.json, "Print the result, or the error, as one JSON document on stdout");

/** Adds the flags that decide how pixels are compared, shared by `diff`, `compare` and `versus`. */
const withComparisonOptions = (command: Command) =>
  command
    .option(`-t, ${FLAGS.threshold} <threshold>`, "Set the threshold for the diff", {
      default: 0.2,
    })
    .option(`${FLAGS.failAbove} <percent>`, "Exit with 1 when a browser's pixel change is above this percentage");

const withBaselineDir = (command: Command) =>
  command.option(`${FLAGS.baselineDir} <dir>`, `Folder the baselines are stored in (default: ${DEFAULT_BASELINE_DIR})`);

/** Adds `--folder`, the base folder for run folders. */
const withFolderOption = (command: Command) =>
  command.option(`-o, ${FLAGS.folder} <folder>`, "Set the base folder for chromascope runs", {
    default: "chromascope-runs",
  });

/** Adds `--folder` and `--out`, which decide where a run writes its artifacts, shared by `diff`, `compare` and `versus`. */
const withRunFolderOptions = (command: Command, artifacts: string) =>
  withFolderOption(command).option(
    `${FLAGS.out} <dir>`,
    `Save the ${artifacts} in exactly this folder, without a run folder`,
  );

const configureOutput = (options: Flags) =>
  output.configure({ verbose: Boolean(options.verbose), quiet: Boolean(options.quiet), json: Boolean(options.json) });

/** Prints the result as JSON, plain text or decorated text, depending on the flags and the terminal. */
const printResult = <T extends object>(result: T, plain: (result: T) => string[], decorated: (result: T) => string[]) =>
  output.result(output.json ? formatJson(result) : output.plain ? plain(result) : decorated(result));

const optionalString = (value: unknown) => (value === undefined ? undefined : String(value));

const parseRunFolderOptions = (options: Flags) => ({
  folder: String(options.folder),
  out: optionalString(options.out),
});

const parseFailAboveOption = (options: Flags) =>
  options.failAbove === undefined ? null : parseFailAbove(options.failAbove);

/** Exits with 1 when a comparison is above `--fail-above`, unless `passAnyway`. */
const failAboveExitCode = (aboveFailAbove: boolean, failAbove: number | null, passAnyway = false) => {
  if (!aboveFailAbove) return EXIT_CODES.ok;
  output.info(`Pixel change above ${FLAGS.failAbove} ${failAbove}%`);
  return passAnyway ? EXIT_CODES.ok : EXIT_CODES.aboveFailAbove;
};

withRunFolderOptions(
  withComparisonOptions(
    withOutputOptions(
      withCaptureOptions(
        cli.command("diff <url>", "Capture the URL in several browsers and compare each against the base browser"),
        { browsers: "chromium,webkit,firefox" },
      ),
    ),
  )
    .option(`${FLAGS.base} <browser>`, "Browser the others are compared against", { default: "chromium" })
    .option(
      `-s, ${FLAGS.saveDiff}`,
      `Save the screenshots and diffs as png in a new run folder inside ${FLAGS.folder}`,
    ),
  "screenshots and diffs as png",
)
  .example("  $ chromascope diff localhost:3000")
  .example("  $ chromascope diff localhost:3000/pricing --element .card --browsers chromium,webkit")
  .example("  $ chromascope diff https://example.com --save-diff")
  .example("  $ chromascope diff localhost:3000 --json --out /tmp/diff --fail-above 1")
  .action(async (url: string, options: Flags) => {
    configureOutput(options);
    const normalizedUrl = parseUrl(url);
    const capture = parseCaptureOptions(options, { browsers: ["chromium", "webkit", "firefox"] });
    const ctx = createChromascopeContext({
      ...capture,
      ...parseBase(options.base, capture.browsers),
      verbose: Boolean(options.verbose),
      threshold: parseThreshold(options.threshold),
      failAbove: parseFailAboveOption(options),
      ...parseRunFolderOptions(options),
      saveDiff: Boolean(options.saveDiff),
    });

    output.debug(`Options provided: ${JSON.stringify(options)}`);
    output.debug(`Diffing URL: ${normalizedUrl}`);
    output.debug(`Run ID: ${ctx.runId}`);
    if (ctx.saveArtifacts) output.debug(`Run folder: ${ctx.runFolder}`);

    const { result, aboveFailAbove } = await diff(normalizedUrl, ctx);
    output.info("Diff complete", "🎉");
    printResult(result, formatDiffPlain, formatDiffDecorated);
    return failAboveExitCode(aboveFailAbove, result.options.failAbove);
  });

withBaselineDir(
  withOutputOptions(
    withCaptureOptions(cli.command("snapshot <url>", "Capture a baseline of the URL for a later compare"), {
      browsers: "chromium",
    }),
  ),
)
  .option(`${FLAGS.name} <name>`, `Baseline name (default: derived from the URL and ${FLAGS.element})`)
  .example("  $ chromascope snapshot localhost:3000/pricing --element .card")
  .example("  $ chromascope snapshot localhost:3000 --browsers chromium,firefox --mask .timestamp")
  .action(async (url: string, options: Flags) => {
    configureOutput(options);
    const normalizedUrl = parseUrl(url);
    const capture = parseCaptureOptions(options, { browsers: ["chromium"] });
    const name =
      options.name === undefined ? deriveBaselineName(normalizedUrl, capture.element) : parseBaselineName(options.name);
    const store = createBaselineStore(optionalString(options.baselineDir));
    output.debug(`Options provided: ${JSON.stringify(options)}`);

    const result = await snapshot(normalizedUrl, name, capture, store);
    output.info(`Saved baseline ${JSON.stringify(name)}`, "🎉");
    printResult(result, formatSnapshotPlain, formatSnapshotDecorated);
    return EXIT_CODES.ok;
  });

withRunFolderOptions(
  withBaselineDir(
    withComparisonOptions(
      withOutputOptions(
        withCaptureOptions(
          cli.command("compare [url]", "Capture the URL again and compare each browser against its baseline"),
          { browsers: "every browser of the baseline", fromBaseline: true },
        ),
      ),
    ),
  )
    .option(
      `${FLAGS.name} <name>`,
      `Baseline name. Without a URL, the baseline's URL is captured (default: derived from the URL and ${FLAGS.element})`,
    )
    .option(FLAGS.update, "Save the new capture as the baseline after comparing. Always exits with 0")
    .option(FLAGS.clean, "Delete the baseline when the comparison exits with 0"),
  "before, after and diff images",
)
  .example("  $ chromascope compare localhost:3000/pricing --element .card --fail-above 0")
  .example("  $ chromascope compare --name homepage --json")
  .example("  $ chromascope compare localhost:3000/pricing --element .card --update")
  .action(async (url: string | undefined, options: Flags) => {
    configureOutput(options);
    if (url === undefined && options.name === undefined) {
      throw usageError(
        "MISSING_ARGUMENT",
        `compare needs a URL or ${FLAGS.name}`,
        `pass the URL you captured the baseline of, or the baseline name with ${FLAGS.name}`,
      );
    }
    if (options.update && options.clean) {
      throw usageError(
        "INVALID_OPTION",
        `${FLAGS.update} and ${FLAGS.clean} can't be used together`,
        "pick one of them",
      );
    }
    const capture = parseCaptureOptions(options, { browsers: ["chromium"] });
    const { result, aboveFailAbove } = await compare(
      {
        url: url === undefined ? null : parseUrl(url),
        name: options.name === undefined ? null : parseBaselineName(options.name),
        capture: {
          imageFlags: parseImageOptions(options),
          browsers: options.browsers === undefined ? null : capture.browsers,
          timeout: capture.timeout,
          cookie: capture.cookie,
        },
        threshold: parseThreshold(options.threshold),
        failAbove: parseFailAboveOption(options),
        update: Boolean(options.update),
        clean: Boolean(options.clean),
        run: parseRunFolderOptions(options),
        baselineDir: optionalString(options.baselineDir),
      },
      createBaselineStore(optionalString(options.baselineDir)),
    );

    output.info("Compare complete", "🎉");
    if (result.updated) output.info(`Updated baseline ${JSON.stringify(result.name)}`);
    if (result.cleaned) output.info(`Deleted baseline ${JSON.stringify(result.name)}`);
    printResult(result, formatComparePlain, formatCompareDecorated);
    return failAboveExitCode(aboveFailAbove, result.options.failAbove, result.updated);
  });

withRunFolderOptions(
  withComparisonOptions(
    withOutputOptions(
      withCaptureOptions(
        cli.command(
          "versus <before-url> <after-url>",
          "Run a URL comparison: compare the second URL against the first in each browser",
        ),
        { browsers: "chromium,webkit,firefox" },
      ),
    ),
  ),
  "before, after and diff images",
)
  .alias("vs")
  .example("  $ chromascope versus https://example.com localhost:3000 --fail-above 0")
  .example(
    "  $ chromascope vs https://example.com/pricing localhost:3000/pricing --element .card --browsers chromium,webkit",
  )
  .example("  $ chromascope versus https://example.com localhost:3000 --cookie session=abc --json --out /tmp/versus")
  .action(async (beforeUrl: string, afterUrl: string, options: Flags) => {
    configureOutput(options);
    const { result, aboveFailAbove } = await versus({
      beforeUrl: parseUrl(beforeUrl),
      afterUrl: parseUrl(afterUrl),
      capture: parseCaptureOptions(options, { browsers: ["chromium", "webkit", "firefox"] }),
      threshold: parseThreshold(options.threshold),
      failAbove: parseFailAboveOption(options),
      run: parseRunFolderOptions(options),
    });

    output.info("URL comparison complete", "🎉");
    printResult(result, formatVersusPlain, formatVersusDecorated);
    return failAboveExitCode(aboveFailAbove, result.options.failAbove);
  });

withBaselineDir(
  withOutputOptions(cli.command("clean [name]", "Delete the baseline with this name, or every baseline")),
).action((name: string | undefined, options: Flags) => {
  configureOutput(options);
  const store = createBaselineStore(optionalString(options.baselineDir));
  const removed = name === undefined ? store.removeAll() : store.remove(parseBaselineName(name));
  output.info(removed ? `Deleted ${removed}` : "No baselines to delete");
  printResult<CleanResult>({ schemaVersion: SCHEMA_VERSION, command: "clean", removed }, formatClean, formatClean);
  return EXIT_CODES.ok;
});

withFolderOption(
  withOutputOptions(
    cli.command("doctor", "Check that Node, the browsers and the output folder are ready for chromascope"),
  ).option(`${FLAGS.browsers} <list>`, `Comma separated browsers to check (default: ${BROWSERS.join(",")})`),
)
  .example("  $ chromascope doctor")
  .example("  $ chromascope doctor --browsers chromium --json")
  .action(async (options: Flags) => {
    configureOutput(options);
    const browserTypes = { chromium, webkit, firefox };
    const browsers = options.browsers === undefined ? [...BROWSERS] : parseBrowsers(options.browsers);
    const step = output.step("Checking the environment", "🩺");
    const result = await runDoctor({
      browserTypes: browsers.map((browser) => browserTypes[browser]),
      folder: String(options.folder),
    });
    const failed = result.checks.filter((check) => !check.ok).length;
    if (failed === 0) step.succeed("Every check passed", "🎉");
    else step.fail(`${failed} ${failed === 1 ? "check" : "checks"} failed`);
    printResult(result, formatDoctorPlain, formatDoctorDecorated);
    return result.ok ? EXIT_CODES.ok : EXIT_CODES.runtime;
  });

cli
  .command("install", "Install the chromium, firefox, and webkit browsers used by chromascope")
  .action(() => installBrowsers());

cli.help((sections) => [
  ...sections,
  {
    title: "Exit codes",
    body: [
      "  0  Success: every comparison is within --fail-above, or no --fail-above was given, or compare --update",
      "  1  At least one comparison is above --fail-above",
      "  2  Usage error: unknown command or option, missing or invalid argument",
      "  3  Runtime error: navigation failed, selector not found, timeout, browser or baseline missing,",
      "     or a doctor check failed",
    ].join("\n"),
  },
  {
    title: "Error codes",
    body: formatErrorCodes().join("\n"),
  },
]);
cli.version(version);

/** Parses the arguments and runs the command. Resolves to the exit code. */
const run = async (): Promise<number> => {
  cli.parse(process.argv, { run: false });
  if (!cli.matchedCommand && process.argv.length <= 2) {
    cli.outputHelp();
    return EXIT_CODES.ok;
  }
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
  if (process.argv.includes(FLAGS.json)) output.configure({ json: true });
  if (process.argv.includes(FLAGS.verbose)) output.configure({ verbose: true });
  if (output.json) output.result(formatJson(toErrorResult(error)));
  output.error(formatError(error).join("\n"));
  output.debug(error.cause ?? error);
  return exitCodeFor(error);
};

process.exitCode = await run().catch(handleError);
