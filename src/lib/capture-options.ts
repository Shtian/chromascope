export const BROWSERS = ["chromium", "webkit", "firefox"] as const;
export type BrowserName = (typeof BROWSERS)[number];

export const WAIT_UNTIL = ["load", "domcontentloaded", "networkidle"] as const;
export type WaitUntil = (typeof WAIT_UNTIL)[number];

export type Viewport = { width: number; height: number };

/** The capture options that change the captured image. */
export type ImageOptions = {
  viewport: Viewport;
  deviceScaleFactor: number;
  /** Capture only the first element matching this selector, instead of the viewport. */
  element: string | null;
  fullPage: boolean;
  /** Wait for an element matching this selector to be visible before capturing. */
  waitFor: string | null;
  waitUntil: WaitUntil;
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
};

export const DEFAULT_TIMEOUT = 30_000;

const isBrowserName = (value: string): value is BrowserName => (BROWSERS as readonly string[]).includes(value);

/** Parses a comma separated list of browsers, like `chromium,firefox`. Repeated flags arrive as an array. */
export const parseBrowsers = (value: unknown): BrowserName[] => {
  const list = Array.isArray(value) ? value.join(",") : value;
  const names = typeof list === "string" ? list.split(",").map((name) => name.trim().toLowerCase()) : [];
  if (names.length === 0 || !names.every(isBrowserName)) {
    throw new Error(
      `--browsers must be a comma separated list of ${BROWSERS.join(", ")}, got ${JSON.stringify(value)}`,
    );
  }
  return [...new Set(names)];
};

/** Validates the base browser and returns the browsers to capture, base first. The base is always captured. */
export const parseBase = (value: unknown, browsers: BrowserName[]) => {
  const base = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!isBrowserName(base)) {
    throw new Error(`--base must be one of ${BROWSERS.join(", ")}, got ${JSON.stringify(value)}`);
  }
  const others = browsers.filter((browser) => browser !== base);
  if (others.length === 0) {
    throw new Error(`diff needs at least one browser besides the base, got --browsers ${browsers.join(",")}`);
  }
  return { base, browsers: [base, ...others] };
};

const viewportRegex = /^(\d+)x(\d+)$/i;

export const parseViewport = (value: unknown): Viewport => {
  const match = typeof value === "string" ? viewportRegex.exec(value.trim()) : null;
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  if (!match || width === 0 || height === 0) {
    throw new Error(`--viewport must be <width>x<height>, like 1280x720, got ${JSON.stringify(value)}`);
  }
  return { width, height };
};

/** Numbers arrive as numbers or strings, depending on how the CLI parser read them. */
const toNumber = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value);

export const parseDeviceScaleFactor = (value: unknown) => {
  const factor = toNumber(value);
  if (typeof factor !== "number" || !(factor > 0)) {
    throw new Error(`--device-scale-factor must be a number above 0, got ${JSON.stringify(value)}`);
  }
  return factor;
};

export const parseTimeout = (value: unknown) => {
  const timeout = toNumber(value);
  if (typeof timeout !== "number" || !Number.isInteger(timeout) || timeout < 0) {
    throw new Error(`--timeout must be a whole number of milliseconds, got ${JSON.stringify(value)}`);
  }
  return timeout;
};

export const parseWaitUntil = (value: unknown): WaitUntil => {
  if (!(WAIT_UNTIL as readonly unknown[]).includes(value)) {
    throw new Error(`--wait-until must be one of ${WAIT_UNTIL.join(", ")}, got ${JSON.stringify(value)}`);
  }
  return value as WaitUntil;
};

const parseSelector = (flag: string, value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${flag} must be a selector, got ${JSON.stringify(value)}`);
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
  if (flags.element !== undefined) options.element = parseSelector("--element", flags.element);
  if (flags.fullPage !== undefined) options.fullPage = Boolean(flags.fullPage);
  if (flags.waitFor !== undefined) options.waitFor = parseSelector("--wait-for", flags.waitFor);
  if (flags.waitUntil !== undefined) options.waitUntil = parseWaitUntil(flags.waitUntil);
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
