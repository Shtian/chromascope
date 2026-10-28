import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { BrowserName, ImageOptions } from "./capture-options";
import { runtimeError, usageError } from "./errors";

/** Where baselines live unless `--baseline-dir` says otherwise, relative to the working directory. */
export const DEFAULT_BASELINE_DIR = path.join(".chromascope", "baselines");

const METADATA_FILE = "metadata.json";
const MAX_NAME_LENGTH = 100;

/** What a baseline records next to its images: enough to capture the page again the same way. */
export type BaselineMetadata = {
  url: string;
  browsers: BrowserName[];
  /** The capture options that change the image. `compare` reuses them. */
  capture: ImageOptions;
  capturedAt: string;
  chromascopeVersion: string;
};

const slug = (value: string) => value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Keeps a name within the length limit, adding a hash of the whole name so shortened names stay unique. */
const shorten = (name: string) => {
  if (name.length <= MAX_NAME_LENGTH) return name;
  const hash = crypto.createHash("sha1").update(name).digest("hex").slice(0, 8);
  return `${name.slice(0, MAX_NAME_LENGTH - hash.length - 1)}-${hash}`;
};

/**
 * Derives the baseline name from the URL's host, port and path, and the element.
 * `http://localhost:3000/pricing` with `.card` becomes `localhost-3000_pricing__card`.
 */
export const deriveBaselineName = (url: string, element: string | null) => {
  const { hostname, port, pathname } = new URL(url);
  const host = [slug(hostname), port].filter(Boolean).join("-");
  const page = [host, ...pathname.split("/").map(slug)].filter(Boolean).join("_");
  return shorten(element === null ? page : `${page}__${slug(element) || "element"}`);
};

const nameRegex = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Validates `--name`. Names are folder names, so they can't contain slashes or start with a dot. */
export const parseBaselineName = (value: unknown) => {
  if (typeof value !== "string" || !nameRegex.test(value) || value.length > MAX_NAME_LENGTH) {
    throw usageError(
      "INVALID_OPTION",
      `--name must be up to ${MAX_NAME_LENGTH} letters, digits, dots, dashes and underscores, got ${JSON.stringify(value)}`,
      "pick a name like --name pricing-page",
    );
  }
  return value;
};

const optionFlags: Record<keyof ImageOptions, string> = {
  viewport: "--viewport",
  deviceScaleFactor: "--device-scale-factor",
  element: "--element",
  fullPage: "--full-page",
  waitFor: "--wait-for",
  waitUntil: "--wait-until",
  mask: "--mask",
};

/** Masks are compared as sets, since their order doesn't change the image. */
const comparable = (key: keyof ImageOptions, value: unknown) =>
  JSON.stringify(key === "mask" ? [...(value as string[])].sort() : value);

const describeValue = (key: keyof ImageOptions, value: unknown) => {
  if (key === "viewport") {
    const { width, height } = value as ImageOptions["viewport"];
    return `${width}x${height}`;
  }
  if (key === "mask") return (value as string[]).join(", ") || "none";
  if (typeof value === "boolean") return value ? "on" : "off";
  return value === null ? "none" : String(value);
};

export type CaptureConflict = { flag: string; given: string; stored: string };

/** The given capture options whose value differs from the baseline's. Options that weren't given never conflict. */
export const findCaptureConflicts = (stored: ImageOptions, given: Partial<ImageOptions>): CaptureConflict[] =>
  (Object.keys(optionFlags) as Array<keyof ImageOptions>)
    .filter((key) => given[key] !== undefined && comparable(key, given[key]) !== comparable(key, stored[key]))
    .map((key) => ({
      flag: optionFlags[key],
      given: describeValue(key, given[key]),
      stored: describeValue(key, stored[key]),
    }));

export const captureConflictError = (conflicts: CaptureConflict[]) =>
  usageError(
    "CAPTURE_OPTION_CONFLICT",
    conflicts.map(({ flag, given, stored }) => `${flag} ${given} differs from the baseline's ${stored}`).join("; "),
    "leave the option out to reuse the baseline's value, run chromascope snapshot again to capture a new baseline, or accept the new capture with chromascope compare --update",
  );

/** Quotes an argument for a POSIX shell, unless it is safe as is. */
const quote = (arg: string) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`);

export type SnapshotCommandOptions = {
  url: string | null;
  name?: string;
  element?: string | null;
  browsers?: BrowserName[];
  baselineDir?: string;
};

/** The `chromascope snapshot` command that captures the baseline a `compare` is missing. */
export const snapshotCommand = ({ url, name, element, browsers, baselineDir }: SnapshotCommandOptions) => {
  const args = ["chromascope", "snapshot", url === null ? "<url>" : quote(url)];
  if (name) args.push("--name", quote(name));
  if (element) args.push("--element", quote(element));
  if (browsers) args.push("--browsers", browsers.join(","));
  if (baselineDir) args.push("--baseline-dir", quote(baselineDir));
  return args.join(" ");
};

export const baselineNotFound = (message: string, command: SnapshotCommandOptions) =>
  runtimeError("BASELINE_NOT_FOUND", message, `capture one first: ${snapshotCommand(command)}`);

export type Baseline = {
  /** Absolute path of the folder with this name's images and metadata. */
  dir: string;
  metadata: BaselineMetadata;
  imagePath: (browser: BrowserName) => string;
  /** Whether the baseline has an image for the browser. */
  has: (browser: BrowserName) => boolean;
};

/** The folder and its ancestors that don't exist yet. */
const missingDirs = (dir: string): string[] => {
  if (fs.existsSync(dir)) return [];
  const parent = path.dirname(dir);
  return parent === dir ? [dir] : [dir, ...missingDirs(parent)];
};

/**
 * Creates the folder, and a `.gitignore` that ignores everything in each `.chromascope` folder it creates on the way.
 * Existing folders, and folders with other names, get no `.gitignore`.
 */
const createRoot = (root: string) => {
  const created = missingDirs(root).filter((dir) => path.basename(dir) === ".chromascope");
  fs.mkdirSync(root, { recursive: true });
  for (const dir of created) fs.writeFileSync(path.join(dir, ".gitignore"), "*\n");
};

/**
 * Stores baselines as `<root>/<name>/<browser>.png` plus `<root>/<name>/metadata.json`.
 * `root` defaults to `.chromascope/baselines`. Creating a `.chromascope` folder also creates a `.gitignore` in it
 * that ignores it all.
 */
export const createBaselineStore = (baselineDir: string | undefined, cwd = process.cwd()) => {
  const root = path.resolve(cwd, baselineDir ?? DEFAULT_BASELINE_DIR);
  const dirOf = (name: string) => path.join(root, name);

  /** Removes the folder and returns its path, or `null` when there was nothing to remove. */
  const removeDir = (dir: string) => {
    if (!fs.existsSync(dir)) return null;
    fs.rmSync(dir, { recursive: true, force: true });
    return dir;
  };

  return {
    root,

    /** Replaces the baseline with this name: every image and the metadata. */
    write(name: string, metadata: BaselineMetadata, images: Partial<Record<BrowserName, Buffer>>) {
      createRoot(root);
      const dir = dirOf(name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      for (const [browser, image] of Object.entries(images)) fs.writeFileSync(path.join(dir, `${browser}.png`), image);
      fs.writeFileSync(path.join(dir, METADATA_FILE), `${JSON.stringify(metadata, null, 2)}\n`);
      return dir;
    },

    /** The baseline with this name, or `undefined` when there is none. */
    read(name: string): Baseline | undefined {
      const dir = dirOf(name);
      const metadataPath = path.join(dir, METADATA_FILE);
      if (!fs.existsSync(metadataPath)) return undefined;
      let metadata: BaselineMetadata;
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      } catch (error) {
        throw runtimeError(
          "BASELINE_INVALID",
          `the baseline metadata in ${metadataPath} can't be read`,
          "capture the baseline again with chromascope snapshot",
          { cause: error },
        );
      }
      const imagePath = (browser: BrowserName) => path.join(dir, `${browser}.png`);
      const has = (browser: BrowserName) => metadata.browsers.includes(browser) && fs.existsSync(imagePath(browser));
      return { dir, metadata, imagePath, has };
    },

    remove: (name: string) => removeDir(dirOf(name)),

    removeAll: () => removeDir(root),
  };
};

export type BaselineStore = ReturnType<typeof createBaselineStore>;
