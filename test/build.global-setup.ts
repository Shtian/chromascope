import { execFileSync } from "node:child_process";
import path from "node:path";

/** Builds `dist/index.js` so the e2e tests run the same binary that gets published. */
export default function setup() {
  const root = path.join(import.meta.dirname, "..");
  execFileSync(path.join(root, "node_modules/.bin/tsdown"), { cwd: root, stdio: "ignore" });
}
