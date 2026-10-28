import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { removeRunFolder } from "./run-folder";

describe("removeRunFolder", () => {
  let baseFolder: string;

  beforeEach(() => {
    baseFolder = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-"));
  });

  afterEach(() => {
    fs.rmSync(baseFolder, { recursive: true, force: true });
  });

  it("should remove the run folder and its contents", () => {
    const runFolder = path.join(baseFolder, "run-1");
    fs.mkdirSync(runFolder);
    fs.writeFileSync(path.join(runFolder, "chromium.png"), "");
    fs.mkdirSync(path.join(baseFolder, "run-0"));

    removeRunFolder(runFolder, baseFolder);

    expect(fs.existsSync(runFolder)).toBe(false);
    expect(fs.existsSync(baseFolder)).toBe(true);
  });

  it("should remove the base folder when it ends up empty", () => {
    const runFolder = path.join(baseFolder, "run-1");
    fs.mkdirSync(runFolder);

    removeRunFolder(runFolder, baseFolder);

    expect(fs.existsSync(baseFolder)).toBe(false);
  });

  it("should do nothing when the folders don't exist", () => {
    const missing = path.join(baseFolder, "missing");

    expect(() => removeRunFolder(path.join(missing, "run-1"), missing)).not.toThrow();
    expect(fs.existsSync(baseFolder)).toBe(true);
  });
});
