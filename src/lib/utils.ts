// A scheme followed by a digit is a host and port, like `localhost:3000`.
const schemeRegex = /^[a-z][a-z\d+.-]*:(?!\d)/i;
const httpRegex = /^https?:\/\//i;
const hostnameRegex = /^[^.]+(?:\.[^.]+)+$/;

/** Returns the URL with `https://` added when it has no scheme, or `undefined` if it isn't an http(s) URL with a host. */
export const normalizeUrl = (input: string) => {
  const trimmed = input.trim();
  const url = schemeRegex.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!httpRegex.test(url) || !URL.canParse(url)) return undefined;

  const { hostname, href } = new URL(url);
  const isValidHost = hostname === "localhost" || hostname.startsWith("[") || hostnameRegex.test(hostname);
  return isValidHost ? href : undefined;
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
