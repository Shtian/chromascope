import { ERROR_CODES, type ErrorCode, type RuntimeErrorCode, type UsageErrorCode } from "./error-codes";
import { type ErrorResult, SCHEMA_VERSION } from "./result";

/** Usage errors mean the command needs fixing. Runtime errors mean the page or the environment is at fault. */
export type ErrorCategory = "usage" | "runtime";

export const EXIT_CODES = {
  /** Every comparison is within `--fail-above`, or none was given. */
  ok: 0,
  /** At least one comparison is above `--fail-above`. */
  aboveFailAbove: 1,
  usage: 2,
  runtime: 3,
} as const;

/** An error with a stable code, a one-line hint naming the fix, and the category that picks the exit code. */
export class ChromascopeError extends Error {
  readonly code: ErrorCode;
  readonly hint: string;
  readonly category: ErrorCategory;

  constructor(code: ErrorCode, message: string, hint: string, category: ErrorCategory, options?: ErrorOptions) {
    super(message, options);
    this.name = "ChromascopeError";
    this.code = code;
    this.hint = hint;
    this.category = category;
  }
}

export const usageError = (code: UsageErrorCode, message: string, hint: string, options?: ErrorOptions) =>
  new ChromascopeError(code, message, hint, "usage", options);

export const invalidOption = (message: string, hint: string) => usageError("INVALID_OPTION", message, hint);

export const runtimeError = (code: RuntimeErrorCode, message: string, hint: string, options?: ErrorOptions) =>
  new ChromascopeError(code, message, hint, "runtime", options);

export const exitCodeFor = (error: ChromascopeError) =>
  error.category === "usage" ? EXIT_CODES.usage : EXIT_CODES.runtime;

/** Playwright appends a call log to its messages. It stays behind `--verbose`, through the error's cause. */
const firstLine = (message: string) => message.split("\n")[0];

const messageOf = (error: unknown) => firstLine(error instanceof Error ? error.message : String(error));

const isTimeout = (error: unknown) => error instanceof Error && error.name === "TimeoutError";

const seconds = (ms: number) => `${ms / 1000}s`;

const HELP_HINT = "run the command with --help to see its arguments and options";

/** Codes for the errors of the CLI argument parser, by the start of their message. */
const argumentErrorCodes: Array<[string, UsageErrorCode]> = [
  ["Unknown option", "INVALID_OPTION"],
  ["option `", "INVALID_OPTION"],
  ["missing required args", "MISSING_ARGUMENT"],
  ["Unused args", "INVALID_ARGUMENT"],
];

/**
 * Turns anything thrown into a chromascope error. Chromascope errors are returned unchanged,
 * argument parser errors become usage errors, and everything else is an unknown runtime error.
 */
export const toChromascopeError = (error: unknown): ChromascopeError => {
  if (error instanceof ChromascopeError) return error;
  const message = messageOf(error);
  if (error instanceof Error && error.name === "CACError") {
    const code = argumentErrorCodes.find(([start]) => message.startsWith(start))?.[1] ?? "INVALID_ARGUMENT";
    return usageError(code, message, HELP_HINT, { cause: error });
  }
  return runtimeError("UNKNOWN_ERROR", message, "run again with --verbose for details", { cause: error });
};

/** The error for a page that failed to load. */
export const navigationError = (error: unknown, url: string, timeout: number) =>
  isTimeout(error)
    ? runtimeError(
        "NAVIGATION_FAILED",
        `${url} did not load within ${seconds(timeout)}`,
        "check that the page finishes loading, or raise the timeout with --timeout",
        { cause: error },
      )
    : runtimeError(
        "NAVIGATION_FAILED",
        `could not load ${url}: ${messageOf(error)}`,
        "check the URL and that the server is running",
        { cause: error },
      );

const invalidSelectorRegex = /while parsing (css )?selector|is not a valid selector/i;

/** The error for a selector that matched nothing in time, or isn't valid. Other errors are returned unchanged. */
export const selectorError = (error: unknown, selector: string, timeout: number) => {
  if (isTimeout(error)) {
    return runtimeError(
      "SELECTOR_TIMEOUT",
      `no element matched ${JSON.stringify(selector)} within ${seconds(timeout)}`,
      "check the selector, or raise the timeout with --timeout",
      { cause: error },
    );
  }
  if (invalidSelectorRegex.test(messageOf(error))) {
    return usageError("INVALID_SELECTOR", `${JSON.stringify(selector)} is not a valid selector`, "fix the selector", {
      cause: error,
    });
  }
  return error;
};

/** The widest a line of the help's error code list may grow. */
const HELP_WIDTH = 110;

/** Joins the codes after the label, wrapping before a line grows past the help's width. */
const wrapCodes = (label: string, codes: readonly string[]) => {
  const words = codes.map((code, index) => (index === codes.length - 1 ? code : `${code},`));
  const lines = [words[0]];
  for (const word of words.slice(1)) {
    const joined = `${lines[lines.length - 1]} ${word}`;
    if (label.length + joined.length > HELP_WIDTH) lines.push(word);
    else lines[lines.length - 1] = joined;
  }
  return lines.map((line, index) => (index === 0 ? label : " ".repeat(label.length)) + line);
};

/** The help's list of error codes, by exit code. */
export const formatErrorCodes = () => [
  ...wrapCodes(`  Usage (exit ${EXIT_CODES.usage}):   `, ERROR_CODES.usage),
  ...wrapCodes(`  Runtime (exit ${EXIT_CODES.runtime}): `, ERROR_CODES.runtime),
];

/** The lines printed on stderr for an error. */
export const formatError = ({ code, message, hint }: ChromascopeError) => [
  `error[${code}]: ${message}`,
  `hint: ${hint}`,
];

export const toErrorResult = ({ code, message, hint }: ChromascopeError): ErrorResult => ({
  schemaVersion: SCHEMA_VERSION,
  error: { code, message, hint },
});
