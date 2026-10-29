import { usageError } from "./errors";
import { FLAGS } from "./flags";
import { parseNumber } from "./utils";

export const BROWSERS = ["chromium", "webkit", "firefox"] as const;
export type BrowserName = (typeof BROWSERS)[number];

export const WAIT_UNTIL = ["load", "domcontentloaded", "networkidle"] as const;
export type WaitUntil = (typeof WAIT_UNTIL)[number];

/** A width and height in pixels: of a viewport, a captured image or a compared canvas. */
export type Size = { width: number; height: number };

/** @deprecated Use `Size`. */
export type Viewport = Size;

/** The capture options that change the captured image. */
export type ImageOptions = {
  viewport: Size;
  deviceScaleFactor: number;
  /** Capture only the first element matching this selector, instead of the viewport. */
  element: string | null;
  fullPage: boolean;
  /** Wait for an element matching this selector to be visible before capturing. */
  waitFor: string | null;
  waitUntil: WaitUntil;
  /** Hide the elements matching these selectors behind a solid box. */
  mask: string[];
};

/** How a page is captured. Shared by every command that captures a page. */
export type CaptureOptions = ImageOptions & {
  browsers: BrowserName[];
  /** Milliseconds each navigation, wait and capture may take. `0` means no limit. */
  timeout: number;
  cookie: string;
};

/** The capture option flags as the CLI parser hands them over: strings, numbers, booleans or nothing. */
export type CaptureFlags = Partial<Record<keyof CaptureOptions, unknown>>;

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  element: null,
  fullPage: false,
  waitFor: null,
  waitUntil: "load",
  mask: [],
};

export const DEFAULT_TIMEOUT = 30_000;

const invalidOption = (message: string, hint: string) => usageError("INVALID_OPTION", message, hint);

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

const viewportRegex = /^(\d+)x(\d+)$/i;

export const parseViewport = (value: unknown): Size => {
  const match = typeof value === "string" ? viewportRegex.exec(value.trim()) : null;
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  if (!match || width === 0 || height === 0) {
    throw invalidOption(
      `${FLAGS.viewport} must be <width>x<height>, like 1280x720, got ${JSON.stringify(value)}`,
      `pass the size as <width>x<height>, like ${FLAGS.viewport} 1280x720`,
    );
  }
  return { width, height };
};

export const parseDeviceScaleFactor = (value: unknown): number =>
  parseNumber(
    value,
    (factor) => factor > 0,
    `${FLAGS.deviceScaleFactor} must be a number above 0`,
    `pass a number above 0, like ${FLAGS.deviceScaleFactor} 2`,
  );

export const parseTimeout = (value: unknown): number =>
  parseNumber(
    value,
    (timeout) => Number.isInteger(timeout) && timeout >= 0,
    `${FLAGS.timeout} must be a whole number of milliseconds`,
    `pass milliseconds, like ${FLAGS.timeout} 5000, or 0 for no limit`,
  );

export const parseWaitUntil = (value: unknown): WaitUntil => {
  if (!(WAIT_UNTIL as readonly unknown[]).includes(value)) {
    throw invalidOption(
      `${FLAGS.waitUntil} must be one of ${WAIT_UNTIL.join(", ")}, got ${JSON.stringify(value)}`,
      `pass one of ${WAIT_UNTIL.join(", ")}`,
    );
  }
  return value as WaitUntil;
};

const parseSelector = (flag: string, value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidOption(
      `${flag} must be a selector, got ${JSON.stringify(value)}`,
      `pass a CSS selector, like ${flag} "#main"`,
    );
  }
  return value;
};

/** Parses the image options that were given. Options that weren't given stay `undefined`. */
export const parseImageOptions = (flags: CaptureFlags): Partial<ImageOptions> => {
  const options: Partial<ImageOptions> = {};
  if (flags.viewport !== undefined) options.viewport = parseViewport(flags.viewport);
  if (flags.deviceScaleFactor !== undefined) {
    options.deviceScaleFactor = parseDeviceScaleFactor(flags.deviceScaleFactor);
  }
  if (flags.element !== undefined) options.element = parseSelector(FLAGS.element, flags.element);
  if (flags.fullPage !== undefined) options.fullPage = Boolean(flags.fullPage);
  if (flags.waitFor !== undefined) options.waitFor = parseSelector(FLAGS.waitFor, flags.waitFor);
  if (flags.waitUntil !== undefined) options.waitUntil = parseWaitUntil(flags.waitUntil);
  if (flags.mask !== undefined) {
    // A repeated flag arrives as an array.
    options.mask = (Array.isArray(flags.mask) ? flags.mask : [flags.mask]).map((mask) =>
      parseSelector(FLAGS.mask, mask),
    );
  }
  return options;
};

/** Parses the capture option flags, filling in the defaults for options that weren't given. */
export const parseCaptureOptions = (flags: CaptureFlags, defaults: { browsers: BrowserName[] }): CaptureOptions => ({
  ...DEFAULT_IMAGE_OPTIONS,
  ...parseImageOptions(flags),
  browsers: flags.browsers === undefined ? defaults.browsers : parseBrowsers(flags.browsers),
  timeout: flags.timeout === undefined ? DEFAULT_TIMEOUT : parseTimeout(flags.timeout),
  cookie: typeof flags.cookie === "string" ? flags.cookie : "",
});

/** The image options out of all capture options. */
export const pickImageOptions = ({
  viewport,
  deviceScaleFactor,
  element,
  fullPage,
  waitFor,
  waitUntil,
  mask,
}: ImageOptions): ImageOptions => ({ viewport, deviceScaleFactor, element, fullPage, waitFor, waitUntil, mask });
