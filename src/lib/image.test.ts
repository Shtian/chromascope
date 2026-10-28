import { describe, expect, it } from "vitest";
import { compareImages, formatBaseResult, formatResult, type ImageWithMetadata, resize } from "./image";

type Rgba = [number, number, number, number];

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const EMPTY: Rgba = [0, 0, 0, 0];

const image = (width: number, height: number, pixel: (x: number, y: number) => Rgba = () => RED): ImageWithMetadata => {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(pixel(x, y), (y * width + x) * 4);
    }
  }
  return { data, width, height };
};

const pixelAt = (img: ImageWithMetadata, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return [...img.data.subarray(i, i + 4)];
};

describe("resize", () => {
  it("should return the same image when the size already matches", () => {
    const img = image(2, 2);
    expect(resize(img, { width: 2, height: 2 })).toBe(img);
  });

  it("should keep the original pixels in the top left corner and pad with transparent pixels", () => {
    const img = image(2, 1, (x) => (x === 0 ? RED : BLUE));
    const resized = resize(img, { width: 3, height: 2 });

    expect(resized.width).toBe(3);
    expect(resized.height).toBe(2);
    expect(resized.data.length).toBe(3 * 2 * 4);
    expect(pixelAt(resized, 0, 0)).toEqual(RED);
    expect(pixelAt(resized, 1, 0)).toEqual(BLUE);
    expect(pixelAt(resized, 2, 0)).toEqual(EMPTY);
    expect(pixelAt(resized, 0, 1)).toEqual(EMPTY);
  });

  it("should grow a zero-size image into a transparent image", () => {
    const resized = resize(image(0, 0), { width: 2, height: 1 });
    expect(resized.data.length).toBe(2 * 1 * 4);
    expect(pixelAt(resized, 1, 0)).toEqual(EMPTY);
  });
});

describe("compareImages", () => {
  it("should report no change for identical images", () => {
    const result = compareImages(image(4, 4), image(4, 4), 0.2);
    expect(result.pixelChange).toBe(0);
    expect(result.pixelChangePercentage).toBe(0);
  });

  it("should count changed pixels and the percentage of the image", () => {
    const changed = image(4, 4, (x, y) => (x === 0 && y === 0 ? BLUE : RED));
    const result = compareImages(image(4, 4), changed, 0.2);
    expect(result.pixelChange).toBe(1);
    expect(result.pixelChangePercentage).toBe(100 / 16);
  });

  it("should produce a diff image of the compared size", () => {
    const result = compareImages(image(4, 4), image(4, 4), 0.2);
    expect(result.diff.width).toBe(4);
    expect(result.diff.height).toBe(4);
    expect(result.diff.data.length).toBe(4 * 4 * 4);
  });

  it("should compare images of different sizes on the largest canvas", () => {
    const result = compareImages(image(2, 2), image(4, 2), 0.2);
    expect(result.diff.width).toBe(4);
    expect(result.diff.height).toBe(2);
    expect(result.pixelChange).toBe(4);
    expect(result.pixelChangePercentage).toBe(50);
  });

  it("should not change the input images when resizing", () => {
    const small = image(2, 2);
    compareImages(small, image(4, 4), 0.2);
    expect(small.width).toBe(2);
    expect(small.data.length).toBe(2 * 2 * 4);
  });

  it("should report no change for two zero-size images", () => {
    const result = compareImages(image(0, 0), image(0, 0), 0.2);
    expect(result.pixelChange).toBe(0);
    expect(result.pixelChangePercentage).toBe(0);
  });

  it("should compare a zero-size image against a non-empty one without throwing", () => {
    const result = compareImages(image(0, 0), image(2, 2), 0.2);
    expect(result.diff.width).toBe(2);
    expect(result.diff.height).toBe(2);
    expect(result.pixelChange).toBeGreaterThan(0);
    expect(result.pixelChangePercentage).toBe((result.pixelChange / 4) * 100);
  });

  it("should pass the threshold to the comparison", () => {
    const almostRed = image(2, 2, () => [250, 0, 0, 255]);
    expect(compareImages(image(2, 2), almostRed, 0.2).pixelChange).toBe(0);
    expect(compareImages(image(2, 2), almostRed, 0).pixelChange).toBe(4);
  });
});

describe("formatBaseResult", () => {
  it("should print nothing when the screenshot wasn't saved", () => {
    expect(formatBaseResult("")).toEqual([]);
  });

  it("should print the base screenshot path", () => {
    expect(formatBaseResult("/runs/1/chromium.png")).toEqual([
      "┌─ 🌐 Chromium (base)",
      "└─ 👉 Screenshot stored at /runs/1/chromium.png",
    ]);
  });
});

describe("formatResult", () => {
  const result = { browserName: "🦊 Firefox", pixelChange: 42, pixelChangePercentage: 1.23456 };

  it("should format the pixel change", () => {
    expect(formatResult({ ...result, diffPath: "", screenshotPath: "" })).toEqual([
      "┌─ 🦊 Firefox",
      "└─ 👉 1.23% pixel change compared to Chromium (42px)",
    ]);
  });

  it("should include the screenshot and diff paths when they were saved", () => {
    expect(formatResult({ ...result, diffPath: "/runs/1/diff.png", screenshotPath: "/runs/1/firefox.png" })).toEqual([
      "┌─ 🦊 Firefox",
      "├─ 👉 1.23% pixel change compared to Chromium (42px)",
      "├─ 👉 Screenshot stored at /runs/1/firefox.png",
      "└─ 👉 Visual diff stored at /runs/1/diff.png",
    ]);
  });
});
