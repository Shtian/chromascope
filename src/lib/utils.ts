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

export const parseThreshold = (value: unknown) => {
  const threshold = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof threshold !== "number" || !(threshold >= 0 && threshold <= 1)) {
    throw new Error(`--threshold must be a number between 0 and 1, got ${JSON.stringify(value)}`);
  }
  return threshold;
};
