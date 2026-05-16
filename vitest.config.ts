import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next", "src/generated", "tests/e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "src/generated/**",
        "src/test/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
      ],
      thresholds: {
        "src/domain/**": {
          lines: 90,
          branches: 85,
        },
        "src/server/**": {
          lines: 80,
        },
        "src/app/api/**": {
          lines: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
