import { formatWithOptions } from "node:util";
import ora from "ora";

type Streams = {
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
  env: NodeJS.ProcessEnv;
};

export type OutputOptions = {
  /** Print debug output on stderr. */
  verbose: boolean;
  /** Print no progress on stderr. Errors still print. */
  quiet: boolean;
};

export type Step = {
  succeed: (text: string, icon?: string) => void;
  fail: (text: string) => void;
};

/** Whether `CI` or `NO_COLOR` is set to something other than an empty or false value. */
const isSet = (value: string | undefined) => Boolean(value) && value !== "false" && value !== "0";

/** Output to a stream is plain, without spinners, emoji or color, unless it is a terminal and nothing turns that off. */
export const isPlain = (isTTY: boolean, { env, quiet }: { env: NodeJS.ProcessEnv; quiet: boolean }) =>
  !isTTY || quiet || isSet(env.CI) || isSet(env.NO_COLOR);

/**
 * The one place that decides where output goes. Results go to stdout and nothing else does.
 * Progress, debug output and errors go to stderr.
 */
export const createOutput = ({ stdout, stderr, env }: Streams = process) => {
  let options: OutputOptions = { verbose: false, quiet: false };
  const writeError = (...args: unknown[]) => stderr.write(`${formatWithOptions({ colors: false }, ...args)}\n`);
  const plainProgress = () => isPlain(Boolean(stderr.isTTY), { env, quiet: options.quiet });
  const withIcon = (text: string, icon?: string) => (icon ? `${text} ${icon}` : text);

  return {
    configure(next: Partial<OutputOptions>) {
      options = { ...options, ...next };
    },

    /** Whether results on stdout are plain text: one line per result, without emoji or box drawing. */
    get plain() {
      return isPlain(Boolean(stdout.isTTY), { env, quiet: options.quiet });
    },

    result(lines: string[]) {
      for (const line of lines) stdout.write(`${line}\n`);
    },

    /** Starts a progress step: a spinner on a terminal, a plain line otherwise, or nothing when quiet. */
    step(text: string, icon?: string): Step {
      if (options.quiet) return { succeed: () => {}, fail: () => {} };
      if (plainProgress()) {
        writeError(text);
        return { succeed: (done) => writeError(done), fail: (failed) => writeError(failed) };
      }
      const spinner = ora({ text: withIcon(text, icon), stream: stderr, discardStdin: false }).start();
      return {
        succeed: (done, doneIcon) => spinner.succeed(withIcon(done, doneIcon)),
        fail: (failed) => spinner.fail(failed),
      };
    },

    /** A progress message that needs no spinner. */
    info(text: string, icon?: string) {
      if (options.quiet) return;
      if (plainProgress()) writeError(text);
      else ora({ stream: stderr, discardStdin: false }).succeed(withIcon(text, icon));
    },

    debug(...args: unknown[]) {
      if (options.verbose) writeError(...args);
    },

    error(...args: unknown[]) {
      writeError(...args);
    },
  };
};

export type Output = ReturnType<typeof createOutput>;

const output = createOutput();

export default output;
