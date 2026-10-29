import { invalidOption } from "./errors";
import { FLAGS, type Flag } from "./flags";
import { parseNumber } from "./utils";

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

/** The image option flags as the CLI parser hands them over: strings, numbers, booleans or nothing. */
export type ImageFlags = Partial<Record<keyof ImageOptions, unknown>>;

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

export const parseWaitUntil = (value: unknown): WaitUntil => {
  if (!(WAIT_UNTIL as readonly unknown[]).includes(value)) {
    throw invalidOption(
      `${FLAGS.waitUntil} must be one of ${WAIT_UNTIL.join(", ")}, got ${JSON.stringify(value)}`,
      `pass one of ${WAIT_UNTIL.join(", ")}`,
    );
  }
  return value as WaitUntil;
};

const parseSelector = (flag: Flag) => (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidOption(
      `${flag} must be a selector, got ${JSON.stringify(value)}`,
      `pass a CSS selector, like ${flag} "#main"`,
    );
  }
  return value;
};

/** Everything chromascope knows about one image option: its flag, help, default, and how it's parsed and described. */
type ImageOptionSpec<Value> = {
  flag: Flag;
  /** The short flag, like `-e`. */
  short?: string;
  /** The placeholder for the flag's value, like `<selector>`. Switches have none. */
  placeholder?: string;
  help: string;
  default: Value;
  parse: (value: unknown) => Value;
  /** What to compare, when values that differ capture the same image. Defaults to the value. */
  comparable?: (value: Value) => unknown;
  /** The value as it's passed to the flag. Defaults to `on`/`off`, `none` or the value as text. */
  describe?: (value: Value) => string;
};

/** One row per image option. The order is the order of conflicts and of the flags in a rendered command. */
const IMAGE_OPTIONS: { [Key in keyof ImageOptions]: ImageOptionSpec<ImageOptions[Key]> } = {
  viewport: {
    flag: FLAGS.viewport,
    placeholder: "<size>",
    help: "Viewport size as <width>x<height>",
    default: { width: 1280, height: 720 },
    parse: parseViewport,
    describe: ({ width, height }) => `${width}x${height}`,
  },
  deviceScaleFactor: {
    flag: FLAGS.deviceScaleFactor,
    placeholder: "<n>",
    help: "Device scale factor, like 2 for retina screenshots",
    default: 1,
    parse: parseDeviceScaleFactor,
  },
  element: {
    flag: FLAGS.element,
    short: "-e",
    placeholder: "<selector>",
    help: "Capture only the element with the given selector",
    default: null,
    parse: parseSelector(FLAGS.element),
  },
  fullPage: {
    flag: FLAGS.fullPage,
    short: "-f",
    help: "Take a full page screenshot",
    default: false,
    parse: Boolean,
  },
  waitFor: {
    flag: FLAGS.waitFor,
    placeholder: "<selector>",
    help: "Wait for the selector to be visible before capturing",
    default: null,
    parse: parseSelector(FLAGS.waitFor),
  },
  waitUntil: {
    flag: FLAGS.waitUntil,
    placeholder: "<event>",
    help: "Page load event to wait for: load, domcontentloaded or networkidle",
    default: "load",
    parse: parseWaitUntil,
  },
  mask: {
    flag: FLAGS.mask,
    placeholder: "<selector>",
    help: "Hide the elements matching the selector. Repeat it to mask more",
    default: [],
    // A repeated flag arrives as an array.
    parse: (value) => (Array.isArray(value) ? value : [value]).map(parseSelector(FLAGS.mask)),
    // Masks are compared as sets, since their order doesn't change the image.
    comparable: (masks) => [...masks].sort(),
    describe: (masks) => masks.join(", ") || "none",
  },
};

export const IMAGE_OPTION_KEYS: Array<keyof ImageOptions> = Object.keys(IMAGE_OPTIONS) as Array<keyof ImageOptions>;

const specOf = <Key extends keyof ImageOptions>(key: Key): ImageOptionSpec<ImageOptions[Key]> => IMAGE_OPTIONS[key];

/** Builds image options, or some of them, from a value per key. */
const fromKeys = (keys: Array<keyof ImageOptions>, value: (key: keyof ImageOptions) => unknown) =>
  Object.fromEntries(keys.map((key) => [key, value(key)])) as Partial<ImageOptions>;

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = fromKeys(
  IMAGE_OPTION_KEYS,
  (key) => specOf(key).default,
) as ImageOptions;

/** Parses the image options that were given. Options that weren't given stay `undefined`. */
export const parseImageOptions = (flags: ImageFlags): Partial<ImageOptions> =>
  fromKeys(
    IMAGE_OPTION_KEYS.filter((key) => flags[key] !== undefined),
    (key) => specOf(key).parse(flags[key]),
  );

/** The image options out of all capture options. */
export const pickImageOptions = (options: ImageOptions): ImageOptions =>
  fromKeys(IMAGE_OPTION_KEYS, (key) => options[key]) as ImageOptions;

/** The image option's flag. */
export const flagOf = (key: keyof ImageOptions): Flag => specOf(key).flag;

/** The value to compare, as text, so values that capture the same image are equal. */
export const comparableValue = <Key extends keyof ImageOptions>(key: Key, value: ImageOptions[Key]): string =>
  JSON.stringify(specOf(key).comparable?.(value) ?? value);

/** The value as it's passed to the flag, or `on`/`off` and `none` for switches and empty values. */
export const describeValue = <Key extends keyof ImageOptions>(key: Key, value: ImageOptions[Key]): string => {
  const { describe } = specOf(key);
  if (describe) return describe(value);
  if (typeof value === "boolean") return value ? "on" : "off";
  return value === null ? "none" : String(value);
};

/** The image options that differ from the defaults, so a command can leave out the rest. */
export const withoutDefaults = (capture: ImageOptions): Partial<ImageOptions> =>
  fromKeys(
    IMAGE_OPTION_KEYS.filter((key) => comparableValue(key, capture[key]) !== comparableValue(key, specOf(key).default)),
    (key) => capture[key],
  );

/** The arguments that pass the image option. Options that are off, empty or not given have none. */
const argsOf = <Key extends keyof ImageOptions>(key: Key, value: ImageOptions[Key] | undefined): string[] => {
  const { flag } = specOf(key);
  if (value === undefined || value === null || value === false) return [];
  if (value === true) return [flag];
  if (Array.isArray(value)) return value.flatMap((item: string) => [flag, item]);
  return [flag, describeValue(key, value)];
};

/** The arguments that pass the image options, unquoted. */
export const imageOptionArgs = (capture: Partial<ImageOptions>): string[] =>
  IMAGE_OPTION_KEYS.flatMap((key) => argsOf(key, capture[key]));

/**
 * The image option as a CLI option: its name with the short flag and placeholder, and its help text with the
 * default. Defaults that pass no flag, like off or none, aren't shown. `fromBaseline` options default to the baseline's.
 */
export const imageOptionHelp = (
  key: keyof ImageOptions,
  { fromBaseline = false }: { fromBaseline?: boolean } = {},
): [string, string] => {
  const spec = specOf(key);
  const name = [spec.short && `${spec.short},`, spec.flag, spec.placeholder].filter(Boolean).join(" ");
  const byDefault = fromBaseline
    ? " (default: the baseline's)"
    : argsOf(key, spec.default).length > 0
      ? ` (default: ${describeValue(key, spec.default)})`
      : "";
  return [name, `${spec.help}${byDefault}`];
};
