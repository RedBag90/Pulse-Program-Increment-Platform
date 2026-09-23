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
        // Server-side tests — must run in Node so jose/nodemailer get real Uint8Array.
        //
        // Das React-Plugin steht hier, seit es **serverseitiges JSX** gibt: das
        // PDF-Dokument des Ziele-Berichts (`goals/server/report/*.tsx`) baut auf
        // `@react-pdf`-Primitiven, nicht auf DOM. Ohne den Plugin scheitert ein
        // Test, der es importiert, mit „React is not defined" — die Umgebung
        // bleibt Node, nur die Transformation kommt dazu.
        plugins: [react()],
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts", "src/modules/**/server/**/*.test.ts"],
          exclude: ["src/server/**/*.integration.test.ts", "src/modules/**/*.integration.test.ts"],
        },
        resolve: { alias },
      },
      {
        // Domain and component tests
        plugins: [react()],
        test: {
          name: "client",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: [
            "src/domain/**/*.test.ts",
            "src/lib/**/*.test.ts",
            // Sprachkataloge und Routing — reine Datenpruefung, kein DOM noetig,
            // laeuft aber hier mit, weil das Server-Projekt nur `src/server`
            // und Modul-Server kennt.
            "src/i18n/**/*.test.ts",
            "src/features/**/*.test.tsx",
            "src/app/**/*.test.tsx",
            "src/components/**/*.test.tsx",
            // Module-Container: Domain-/Client-Tests laufen im jsdom-Projekt.
            "src/modules/**/domain/**/*.test.ts",
            "src/modules/**/*.test.tsx",
            // Seed-Helfer: rein, ohne Prisma — laufen hier mit.
            "prisma/**/*.test.ts",
          ],
        },
        resolve: { alias },
      },
      {
        // Integration tests — require DATABASE_URL_TEST and a running Supabase instance
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          setupFiles: ["./src/test/setup-db.ts"],
          testTimeout: 30_000,
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
