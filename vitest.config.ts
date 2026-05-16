import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const alias = { "@": resolve(__dirname, "src") };

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["node_modules", ".next", "src/generated", "tests/e2e"],
    projects: [
      {
        // Server-side tests — must run in Node so jose/nodemailer get real Uint8Array
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts"],
        },
        resolve: { alias },
      },
      {
        // Domain and component tests
        plugins: [react()],
        test: {
          name: "client",
          environment: "jsdom",
          include: [
            "src/domain/**/*.test.ts",
            "src/features/**/*.test.tsx",
            "src/app/**/*.test.tsx",
          ],
        },
        resolve: { alias },
      },
    ],
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
  resolve: { alias },
});
