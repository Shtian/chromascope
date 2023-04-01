import { v4 as uuid } from "uuid";

interface ChromascopeOptions {
  verbose: boolean;
}

export interface ChromascopeContext {
  runId: string;
  options: ChromascopeOptions;
}

export function createChromascopeContext(options: ChromascopeOptions) {
  const ctx: ChromascopeContext = {
    runId: uuid(),
    options,
  };

  return ctx;
}
