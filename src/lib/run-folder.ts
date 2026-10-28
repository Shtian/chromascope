import fs from "node:fs";

export const removeRunFolder = (runFolder: string, baseFolder: string) => {
  fs.rmSync(runFolder, { recursive: true, force: true });

  if (fs.existsSync(baseFolder) && fs.readdirSync(baseFolder).length === 0) {
    fs.rmSync(baseFolder, { recursive: true, force: true });
  }
};
