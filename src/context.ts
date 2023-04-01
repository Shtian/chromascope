interface ChromascopeOptions {
  verbose: boolean;
  threshold: number;
  folder: string;
  saveDiff: boolean;
}

export interface ChromascopeContext {
  runId: string;
  options: ChromascopeOptions;
}

export function createChromascopeContext(options: ChromascopeOptions) {
  const runId = createRunId();
  const ctx: ChromascopeContext = {
    runId,
    options: { ...options, folder: `${options.folder}/${runId}` },
  };

  return ctx;
}

const createRunId = () => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const formattedDate = `${year}${month}${day}${hours}${minutes}${seconds}`;
  return formattedDate;
};
