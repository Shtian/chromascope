import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  format: "esm",
  platform: "node",
  minify: true,
  // Emit dist/index.js (not .mjs) to match `bin` in package.json.
  fixedExtension: false,
});
