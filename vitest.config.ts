import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        // Glue around the CLI, Playwright and the terminal. Covered by the integration and e2e tests instead.
        "src/index.ts",
        "src/commands/diff.ts",
        "src/lib/install.ts",
        "src/lib/spinner.ts",
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/**/*.integration.test.ts"],
          testTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["test/**/*.e2e.test.ts"],
          globalSetup: ["test/build.global-setup.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
