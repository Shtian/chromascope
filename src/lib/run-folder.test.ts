import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRunFolder } from "./run-folder";

const options = {};

describe("createRunFolder", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create the run folder and the base folder", () => {
    const runFolder = path.join(tempDir, "runs", "run-1");

    createRunFolder({ runFolder, options });

    expect(fs.statSync(runFolder).isDirectory()).toBe(true);
  });

  it("should fail when the run folder already exists", () => {
    const runFolder = path.join(tempDir, "run-1");
    fs.mkdirSync(runFolder);

    expect(() => createRunFolder({ runFolder, options })).toThrow("EEXIST");
  });

  it("should create the --out folder", () => {
    const runFolder = path.join(tempDir, "a", "b");

    createRunFolder({ runFolder, options: { ...options, out: runFolder } });

    expect(fs.statSync(runFolder).isDirectory()).toBe(true);
  });

  it("should reuse an existing --out folder", () => {
    fs.writeFileSync(path.join(tempDir, "chromium.png"), "");

    expect(() => createRunFolder({ runFolder: tempDir, options: { ...options, out: tempDir } })).not.toThrow();
    expect(fs.readdirSync(tempDir)).toEqual(["chromium.png"]);
  });
});
