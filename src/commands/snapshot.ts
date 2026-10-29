import { version } from "../../package.json";
import type { BaselineStore } from "../lib/baselines";
import { captureAll } from "../lib/capture";
import { type CaptureOptions, pickImageOptions } from "../lib/capture-options";
import { byBrowser, SCHEMA_VERSION, type SnapshotResult, timingsOf } from "../lib/result";

/** Captures a baseline per browser and stores it under the name, replacing any baseline with that name. */
export const snapshot = async (
  url: string,
  name: string,
  options: CaptureOptions,
  store: BaselineStore,
): Promise<SnapshotResult> => {
  const started = performance.now();
  const captures = await captureAll(options.browsers, url, options);
  const capturedAt = new Date().toISOString();
  const capture = pickImageOptions(options);

  const { dir, images } = store.write(
    name,
    { url, browsers: options.browsers, capture, capturedAt, chromascopeVersion: version },
    byBrowser(captures, ({ image }) => image),
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    command: "snapshot",
    name,
    baselineDir: dir,
    url,
    options: { ...capture, browsers: options.browsers, timeout: options.timeout },
    baselines: images,
    capturedAt,
    timings: timingsOf(started, captures),
  };
};
