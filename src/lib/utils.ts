const urlRegex =
  /^(?:(?:https?|ftp):\/\/)?(?:localhost|\S+(?:\.[^\s.]+)+|\[?[0-9a-fA-F:]+\]?)(?::\d+)?(?:\/[\w#!:.?+=&%@!\-/]*)?(?:\?[\w&=]+)?$/i;

export const isUrl = (url: string) => urlRegex.test(url);

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
