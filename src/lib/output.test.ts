import { describe, expect, it } from "vitest";
import { createOutput, isPlain, type OutputOptions } from "./output";

/** A stand-in for stdout or stderr that records what was written. */
const fakeStream = (isTTY: boolean) => {
  const chunks: string[] = [];
  const stream = {
    isTTY,
    columns: 80,
    chunks,
    write: (chunk: string) => {
      chunks.push(chunk);
      return true;
    },
    // ora hides and shows the cursor and listens for resizes on TTY streams.
    on: () => stream,
    once: () => stream,
    removeListener: () => stream,
    off: () => stream,
    cursorTo: () => true,
    clearLine: () => true,
    moveCursor: () => true,
  };
  return stream;
};

const setup = ({
  tty = false,
  env = {},
  ...options
}: { tty?: boolean; env?: NodeJS.ProcessEnv } & Partial<OutputOptions> = {}) => {
  const stdout = fakeStream(tty);
  const stderr = fakeStream(tty);
  const output = createOutput({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
    env,
  });
  output.configure(options);
  return { output, stdout: () => stdout.chunks.join(""), stderr: () => stderr.chunks.join("") };
};

describe("isPlain", () => {
  it("should decorate a terminal", () => {
    expect(isPlain(true, { env: {}, quiet: false })).toBe(false);
  });

  it.each([
    ["not a terminal", false, {}, false],
    ["CI", true, { CI: "true" }, false],
    ["NO_COLOR", true, { NO_COLOR: "1" }, false],
    ["--quiet", true, {}, true],
  ])("should be plain when %s", (_, isTTY, env, quiet) => {
    expect(isPlain(isTTY, { env, quiet })).toBe(true);
  });

  it.each([{ CI: "" }, { CI: "false" }, { CI: "0" }, { NO_COLOR: "" }])("should ignore an empty or false %j", (env) => {
    expect(isPlain(true, { env, quiet: false })).toBe(false);
  });
});

describe("createOutput", () => {
  it("should write results to stdout and nothing else", () => {
    const { output, stdout, stderr } = setup();
    output.result(["webkit 0.12% 1104px", "firefox 0.00% 0px"]);
    expect(stdout()).toBe("webkit 0.12% 1104px\nfirefox 0.00% 0px\n");
    expect(stderr()).toBe("");
  });

  it("should write errors to stderr, even when quiet", () => {
    const { output, stdout, stderr } = setup({ quiet: true });
    output.error("error[INVALID_URL]: nope");
    expect(stderr()).toBe("error[INVALID_URL]: nope\n");
    expect(stdout()).toBe("");
  });

  it("should write debug output to stderr only when verbose", () => {
    const quiet = setup();
    quiet.output.debug("hidden");
    expect(quiet.stderr()).toBe("");

    const verbose = setup({ verbose: true });
    verbose.output.debug("Run ID:", 42, { a: 1 });
    expect(verbose.stderr()).toBe("Run ID: 42 { a: 1 }\n");
    expect(verbose.stdout()).toBe("");
  });

  it("should print plain progress lines without emoji when not a terminal", () => {
    const { output, stdout, stderr } = setup();
    const step = output.step("Capturing chromium", "📷");
    step.succeed("Captured chromium", "📸");
    output.step("Capturing webkit").fail("Failed to capture webkit");
    output.info("Diff complete", "🎉");
    expect(stderr()).toBe(
      "Capturing chromium\nCaptured chromium\nCapturing webkit\nFailed to capture webkit\nDiff complete\n",
    );
    expect(stdout()).toBe("");
  });

  it("should print no progress when quiet", () => {
    const { output, stderr } = setup({ quiet: true });
    output.step("Capturing chromium").succeed("Captured chromium");
    output.info("Diff complete");
    expect(stderr()).toBe("");
  });

  it("should print no progress with --json", () => {
    const { output, stderr } = setup({ tty: true, json: true });
    output.step("Capturing chromium").succeed("Captured chromium");
    output.info("Diff complete");
    expect(stderr()).toBe("");
    expect(output.json).toBe(true);
  });

  it("should decorate progress with emoji on a terminal", () => {
    const { output, stderr, stdout } = setup({ tty: true });
    output.step("Capturing chromium", "📷").succeed("Captured chromium", "📸");
    output.step("Capturing webkit").fail("Failed to capture webkit");
    output.info("Diff complete", "🎉");
    expect(stderr()).toContain("Captured chromium 📸");
    expect(stderr()).toContain("Failed to capture webkit");
    expect(stderr()).toContain("Diff complete 🎉");
    expect(stdout()).toBe("");
  });

  it("should report whether results are plain", () => {
    expect(setup({ tty: true }).output.plain).toBe(false);
    expect(setup({ tty: true, env: { NO_COLOR: "1" } }).output.plain).toBe(true);
    expect(setup({ tty: false }).output.plain).toBe(true);
  });
});
