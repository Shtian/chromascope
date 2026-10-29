import { invalidOption } from "./errors";
import { FLAGS } from "./flags";
import { DEFAULT_IMAGE_OPTIONS, type ImageOptions, parseImageOptions } from "./image-options";
import { parseNumber } from "./utils";

export const BROWSERS = ["chromium", "webkit", "firefox"] as const;
export type BrowserName = (typeof BROWSERS)[number];

/** How a page is captured. Shared by every command that captures a page. */
export type CaptureOptions = ImageOptions & {
  browsers: BrowserName[];
  /** Milliseconds each navigation, wait and capture may take. `0` means no limit. */
  timeout: number;
  cookie: string;
};

/** The capture option flags as the CLI parser hands them over: strings, numbers, booleans or nothing. */
export type CaptureFlags = Partial<Record<keyof CaptureOptions, unknown>>;

export const DEFAULT_TIMEOUT = 30_000;

const isBrowserName = (value: string): value is BrowserName => (BROWSERS as readonly string[]).includes(value);

/** Parses a comma separated list of browsers, like `chromium,firefox`. Repeated flags arrive as an array. */
export const parseBrowsers = (value: unknown): BrowserName[] => {
  const list = Array.isArray(value) ? value.join(",") : value;
  const names = typeof list === "string" ? list.split(",").map((name) => name.trim().toLowerCase()) : [];
  if (names.length === 0 || !names.every(isBrowserName)) {
    throw invalidOption(
      `${FLAGS.browsers} must be a comma separated list of ${BROWSERS.join(", ")}, got ${JSON.stringify(value)}`,
      `pass a comma separated list, like ${FLAGS.browsers} chromium,firefox`,
    );
  }
  return [...new Set(names)];
};

/** Validates the base browser and returns the browsers to capture, base first. The base is always captured. */
export const parseBase = (value: unknown, browsers: BrowserName[]): { base: BrowserName; browsers: BrowserName[] } => {
  const base = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!isBrowserName(base)) {
    throw invalidOption(
      `${FLAGS.base} must be one of ${BROWSERS.join(", ")}, got ${JSON.stringify(value)}`,
      `pass one of ${BROWSERS.join(", ")}`,
    );
  }
  const others = browsers.filter((browser) => browser !== base);
  if (others.length === 0) {
    throw invalidOption(
      `diff needs at least one browser besides the base, got ${FLAGS.browsers} ${browsers.join(",")}`,
      `add another browser to ${FLAGS.browsers}, or pick another ${FLAGS.base}`,
    );
  }
  return { base, browsers: [base, ...others] };
};

export const parseTimeout = (value: unknown): number =>
  parseNumber(
    value,
    (timeout) => Number.isInteger(timeout) && timeout >= 0,
    `${FLAGS.timeout} must be a whole number of milliseconds`,
    `pass milliseconds, like ${FLAGS.timeout} 5000, or 0 for no limit`,
  );

/** Parses the capture option flags, filling in the defaults for options that weren't given. */
export const parseCaptureOptions = (flags: CaptureFlags, defaults: { browsers: BrowserName[] }): CaptureOptions => ({
  ...DEFAULT_IMAGE_OPTIONS,
  ...parseImageOptions(flags),
  browsers: flags.browsers === undefined ? defaults.browsers : parseBrowsers(flags.browsers),
  timeout: flags.timeout === undefined ? DEFAULT_TIMEOUT : parseTimeout(flags.timeout),
  cookie: typeof flags.cookie === "string" ? flags.cookie : "",
});
