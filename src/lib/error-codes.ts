/** Every error code, by category. The help lists them in this order. */
export const ERROR_CODES = {
  usage: [
    "INVALID_URL",
    "INVALID_OPTION",
    "INVALID_ARGUMENT",
    "MISSING_ARGUMENT",
    "UNKNOWN_COMMAND",
    "INVALID_SELECTOR",
    "CAPTURE_OPTION_CONFLICT",
  ],
  runtime: [
    "BROWSER_NOT_INSTALLED",
    "NAVIGATION_FAILED",
    "SELECTOR_TIMEOUT",
    "BASELINE_NOT_FOUND",
    "BASELINE_INVALID",
    "UNKNOWN_ERROR",
  ],
} as const;

export type UsageErrorCode = (typeof ERROR_CODES.usage)[number];
export type RuntimeErrorCode = (typeof ERROR_CODES.runtime)[number];
export type ErrorCode = UsageErrorCode | RuntimeErrorCode;
