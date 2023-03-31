const urlRegex =
  /^(?:(?:https?|ftp):\/\/)?(?:localhost|\S+(?:\.[^\s.]+)+|\[?[0-9a-fA-F:]+\]?)(?::\d+)?(?:\/[\w#!:.?+=&%@!\-\/]*)?(?:\?[\w&=]+)?$/i;

export const isUrl = (url: string) => urlRegex.test(url);
