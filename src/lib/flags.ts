/** The long name of each CLI flag, by the option key the CLI parser hands over. */
export const FLAGS = {
  browsers: "--browsers",
  base: "--base",
  element: "--element",
  fullPage: "--full-page",
  viewport: "--viewport",
  deviceScaleFactor: "--device-scale-factor",
  timeout: "--timeout",
  waitFor: "--wait-for",
  waitUntil: "--wait-until",
  mask: "--mask",
  cookie: "--cookie",
  threshold: "--threshold",
  failAbove: "--fail-above",
  saveDiff: "--save-diff",
  folder: "--folder",
  out: "--out",
  name: "--name",
  update: "--update",
  clean: "--clean",
  baselineDir: "--baseline-dir",
  verbose: "--verbose",
  quiet: "--quiet",
  json: "--json",
} as const;

export type Flag = (typeof FLAGS)[keyof typeof FLAGS];
