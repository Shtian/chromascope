import fs from "node:fs";
import path from "node:path";
import type { BrowserType } from "playwright";
import { engines } from "../../package.json";
import { withBrowser } from "./browser";
import { ChromascopeError } from "./errors";
import { type DoctorCheck, type DoctorResult, SCHEMA_VERSION } from "./result";

const pass = (name: string, message: string): DoctorCheck => ({ name, ok: true, message, fix: null });
const fail = (name: string, message: string, fix: string): DoctorCheck => ({ name, ok: false, message, fix });

const parseVersion = (version: string) =>
  version
    .replace(/^[^\d]*/, "")
    .split(".")
    .map(Number);

/** Whether `version` is at least `minimum`, comparing major, minor and patch. */
export const isAtLeast = (version: string, minimum: string) => {
  const current = parseVersion(version);
  const required = parseVersion(minimum);
  for (let index = 0; index < required.length; index++) {
    const difference = (current[index] ?? 0) - (required[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
};

/** Checks the running Node version against `engines.node` in package.json, like `>=22.12`. */
export const checkNode = (version = process.versions.node, range = engines.node): DoctorCheck => {
  const message = `node ${version}, needs ${range}`;
  return isAtLeast(version, range)
    ? pass("node", message)
    : fail("node", message, `install Node ${range.replace(/^>=/, "")} or later`);
};

/** Checks that Playwright can launch the browser, and closes it again. */
export const checkBrowser = async (browserType: BrowserType): Promise<DoctorCheck> => {
  const name = browserType.name();
  try {
    await withBrowser(browserType, async () => {});
    return pass(name, `${name} launches`);
  } catch (error) {
    if (error instanceof ChromascopeError) return fail(name, error.message, error.hint);
    const message = (error instanceof Error ? error.message : String(error)).split("\n")[0];
    return fail(
      name,
      `${name} doesn't launch: ${message}`,
      "install the system libraries it needs with `npx playwright install-deps`",
    );
  }
};

/** The folder itself, or the nearest parent that exists. Chromascope creates the missing ones. */
const nearestExisting = (folder: string) => {
  let current = folder;
  while (!fs.existsSync(current) && path.dirname(current) !== current) current = path.dirname(current);
  return current;
};

/** Checks that chromascope can create and write the output folder, without writing anything. */
export const checkFolder = (folder: string): DoctorCheck => {
  const absolute = path.resolve(folder);
  const existing = nearestExisting(absolute);
  const fix = "pass a writable folder with --folder, or fix the folder's permissions";
  if (!fs.statSync(existing).isDirectory()) {
    return fail("folder", `${absolute} can't be created: ${existing} is not a folder`, fix);
  }
  try {
    fs.accessSync(existing, fs.constants.W_OK);
  } catch {
    return fail("folder", `${absolute} is not writable: no write access to ${existing}`, fix);
  }
  return pass("folder", `${absolute} is writable`);
};

/** Runs every check. The browsers launch at the same time. */
export const runDoctor = async ({
  browserTypes,
  folder,
}: {
  browserTypes: BrowserType[];
  folder: string;
}): Promise<DoctorResult> => {
  const checks = [checkNode(), ...(await Promise.all(browserTypes.map(checkBrowser))), checkFolder(folder)];
  return { schemaVersion: SCHEMA_VERSION, command: "doctor", ok: checks.every((check) => check.ok), checks };
};
