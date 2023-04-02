import { Ora } from "ora";

export type ChromascopeOptions = {
  verbose: boolean;
  threshold: number;
  folder: string;
  saveDiff: boolean;
  element: string;
  fullPage: boolean;
  cookie: string;
};

export type ChromascopeContext = {
  runId: string;
  spinner: Ora;
  runFolder: string;
  options: ChromascopeOptions;
};

export function createChromascopeContext(options: ChromascopeOptions, spinner: Ora) {
  const runId = createRunId();
  const runFolder = `${options.folder}/${runId}`;
  const ctx: ChromascopeContext = {
    runId,
    spinner,
    runFolder,
    options,
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
