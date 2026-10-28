import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "src/index.ts",
    format: "esm",
    platform: "node",
    minify: true,
    // Emit dist/index.js (not .mjs) to match `bin` in package.json.
    fixedExtension: false,
    // tsdown turns declarations on when package.json has `types`. The CLI has none; they come from src/types.ts.
    dts: false,
  },
  {
    // The `--json` result types for package consumers. Declarations only, since the package has no runtime API.
    entry: "src/types.ts",
    format: "esm",
    platform: "node",
    fixedExtension: false,
    // TypeScript 7 has no classic compiler API, so Oxc emits the declarations. It needs explicit return types on
    // exported functions in every module src/types.ts reaches (isolated declarations), or the build fails.
    dts: { emitDtsOnly: true, generator: "oxc" },
  },
]);
