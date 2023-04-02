const urlRegex =
  /^(?:(?:https?|ftp):\/\/)?(?:localhost|\S+(?:\.[^\s.]+)+|\[?[0-9a-fA-F:]+\]?)(?::\d+)?(?:\/[\w#!:.?+=&%@!\-\/]*)?(?:\?[\w&=]+)?$/i;

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
