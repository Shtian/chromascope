import { type ErrorResult, SCHEMA_VERSION } from "./result";

/** An error with a stable code and a one-line hint naming the fix. */
export class ChromascopeError extends Error {
  readonly code: string;
  readonly hint: string;

  constructor(code: string, message: string, hint: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ChromascopeError";
    this.code = code;
    this.hint = hint;
  }
}

/** Wraps any thrown value in a chromascope error. Chromascope errors are returned unchanged. */
export const toChromascopeError = (error: unknown) => {
  if (error instanceof ChromascopeError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ChromascopeError("UNKNOWN_ERROR", message, "Run again with --verbose for details", { cause: error });
};

export const toErrorResult = ({ code, message, hint }: ChromascopeError): ErrorResult => ({
  schemaVersion: SCHEMA_VERSION,
  error: { code, message, hint },
});
