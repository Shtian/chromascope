import { usageError } from "./errors";
import { FLAGS } from "./flags";

// A scheme followed by a digit is a host and port, like `localhost:3000`.
const schemeRegex = /^[a-z][a-z\d+.-]*:(?!\d)/i;
const httpRegex = /^https?:\/\//i;
const hostnameRegex = /^[^.]+(?:\.[^.]+)+$/;
const ipv4LoopbackRegex = /^127\.\d+\.\d+\.\d+$/;

/** Whether the parsed hostname points at the local machine: `localhost`, `*.localhost`, `127.0.0.0/8` or `[::1]`. */
export const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "[::1]" ||
  ipv4LoopbackRegex.test(hostname);

/**
 * Returns the URL with a scheme added when it has none, or `undefined` if it isn't an http(s) URL with a host.
 * Loopback hosts get `http://`, since local dev servers rarely serve https. Everything else gets `https://`.
 */
export const normalizeUrl = (input: string) => {
  const trimmed = input.trim();
  const hasScheme = schemeRegex.test(trimmed);
  const url = hasScheme ? trimmed : `https://${trimmed}`;
  if (!httpRegex.test(url) || !URL.canParse(url)) return undefined;

  const parsed = new URL(url);
  const { hostname } = parsed;
  const isValidHost = hostname === "localhost" || hostname.startsWith("[") || hostnameRegex.test(hostname);
  if (!isValidHost) return undefined;

  if (!hasScheme && isLoopbackHost(hostname)) parsed.protocol = "http:";
  return parsed.href;
};

export const isUrl = (url: string) => normalizeUrl(url) !== undefined;

export const parseCookieOptions = (cookies: string, url: string) => {
  const parsedCookies: Array<{ name: string; value: string; url: string }> = [];
  cookies.split(";").forEach((cookie) => {
    if (!cookie) return;
    const indexOfEquals = cookie.indexOf("=");
    const key = cookie.slice(0, indexOfEquals);
    const values = cookie.slice(indexOfEquals + 1);
    parsedCookies.push({ name: key.trim(), value: values.trim(), url });
  });
  return parsedCookies;
};

/**
 * Parses a number option, which arrives as a number or a string depending on how the CLI parser read it.
 * Fails with "<expected>, got <value>" when it isn't a number or `isValid` rejects it.
 */
export const parseNumber = (value: unknown, isValid: (number: number) => boolean, expected: string, hint: string) => {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !isValid(number)) {
    throw usageError("INVALID_OPTION", `${expected}, got ${JSON.stringify(value)}`, hint);
  }
  return number;
};

/** Quotes an argument for a POSIX shell, unless it is safe as is. */
export const shellQuote = (arg: string) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`);

export const parseThreshold = (value: unknown) =>
  parseNumber(
    value,
    (threshold) => threshold >= 0 && threshold <= 1,
    `${FLAGS.threshold} must be a number between 0 and 1`,
    `pass a number between 0 and 1, like ${FLAGS.threshold} 0.1`,
  );

export const parseFailAbove = (value: unknown) =>
  parseNumber(
    value,
    (percent) => percent >= 0 && percent <= 100,
    `${FLAGS.failAbove} must be a percentage between 0 and 100`,
    `pass the highest pixel change percentage that still passes, like ${FLAGS.failAbove} 0.5`,
  );

/** Whether any comparison's pixel change percentage is above `--fail-above`. Never true without `--fail-above`. */
export const exceedsFailAbove = (comparisons: Array<{ pixelChangePercentage: number }>, failAbove: number | null) =>
  failAbove !== null && comparisons.some(({ pixelChangePercentage }) => pixelChangePercentage > failAbove);

/** Parses the URL argument, adding a scheme when it has none. */
export const parseUrl = (value: unknown) => {
  const url = typeof value === "string" ? normalizeUrl(value) : undefined;
  if (!url) {
    throw usageError(
      "INVALID_URL",
      `${JSON.stringify(value)} is not a valid http(s) URL`,
      "pass an http(s) URL with a host, like http://localhost:3000",
    );
  }
  return url;
};
