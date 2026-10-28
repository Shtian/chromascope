import pixelmatch from "pixelmatch";
import { PNG, type PNGWithMetadata } from "pngjs";
import logger from "./logger";

export type ImageWithMetadata = Pick<PNGWithMetadata, "data" | "width" | "height">;
type Size = { width: number; height: number };

export type ComparisonResult = {
  pixelChange: number;
  pixelChangePercentage: number;
  diff: PNG;
};

export type FormattableResult = {
  browserName: string;
  pixelChange: number;
  pixelChangePercentage: number;
  diffPath: string;
};

/** Compares two images pixel by pixel. Images of different sizes are compared on the largest canvas. */
export const compareImages = (
  imageOne: ImageWithMetadata,
  imageTwo: ImageWithMetadata,
  threshold: number,
): ComparisonResult => {
  const size = {
    width: Math.max(imageOne.width, imageTwo.width),
    height: Math.max(imageOne.height, imageTwo.height),
  };
  const one = resize(imageOne, size);
  const two = resize(imageTwo, size);

  const diff = new PNG(size);
  const pixelChange = pixelmatch(one.data, two.data, diff.data, size.width, size.height, { threshold });
  const area = size.width * size.height;
  const pixelChangePercentage = area === 0 ? 0 : (pixelChange / area) * 100;

  return { pixelChange, pixelChangePercentage, diff };
};

/** Pads the image with transparent pixels to the given size, keeping the original in the top left corner. */
export const resize = (image: ImageWithMetadata, { width, height }: Size): ImageWithMetadata => {
  if (image.width === width && image.height === height) return image;
  logger.debug(`Resizing image to ${width}x${height}...`);
  const data = Buffer.alloc(width * height * 4);
  const rowLength = Math.min(image.width, width) * 4;
  for (let y = 0; y < Math.min(image.height, height); y++) {
    const from = y * image.width * 4;
    image.data.copy(data, y * width * 4, from, from + rowLength);
  }
  return { data, width, height };
};

export const formatResult = (res: FormattableResult) => {
  const lines = [
    `┌─ ${res.browserName}`,
    `${res.diffPath ? "├─" : "└─"} 👉 ${res.pixelChangePercentage.toFixed(2)}% pixel change compared to Chromium (${
      res.pixelChange
    }px)`,
  ];
  if (res.diffPath) lines.push(`└─ 👉 Visual diff stored at ${res.diffPath}`);
  return lines;
};
