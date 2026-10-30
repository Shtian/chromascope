import { PNG } from "pngjs";
import type { Capturer } from "../src/lib/capturer";

export type Rgb = [number, number, number];
export const RED: Rgb = [255, 0, 0];
export const BLUE: Rgb = [0, 0, 255];

/** A PNG of one solid color. */
export const png = (width: number, height: number, color: Rgb) => {
  const image = new PNG({ width, height });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([...color, 255], i);
  return PNG.sync.write(image);
};

/**
 * A capturer that needs no browser: it returns a red 4x2 PNG, or the image in `images` keyed by `<browser> <url>`.
 * `calls` records every capture, in order.
 */
export const fakeCapturer = (images: Record<string, Buffer> = {}) => {
  const calls: string[] = [];
  const capturer: Capturer = async (browser, url) => {
    calls.push(`${browser} ${url}`);
    return images[`${browser} ${url}`] ?? png(4, 2, RED);
  };
  return { capturer, calls };
};

/** A capturer whose every capture fails. */
export const failingCapturer: Capturer = async (browser) => {
  throw new Error(`${browser} failed`);
};
