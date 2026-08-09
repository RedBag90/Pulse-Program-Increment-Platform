// @ts-check
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "src/generated/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "*.config.ts",
      "*.config.mjs",
      "*.config.js",
      "instrumentation.ts",
      "instrumentation-client.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      ...tsPlugin.configs["recommended"].rules,
      // @ts-ignore — next plugin recommended rules
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // ── Modul-Grenzen (ADR-0013): Importe nur abwärts, Drumbeat ⊥ Budgeting.
  //    Greift, sobald Code nach src/modules/<m>/ wandert (P2+). Bis dahin dormant.
  {
    files: ["src/modules/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/work",
                "@/modules/work/**",
                "@/modules/drumbeat",
                "@/modules/drumbeat/**",
                "@/modules/budgeting",
                "@/modules/budgeting/**",
              ],
              message: "core darf nicht aufwärts importieren (ADR-0013).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/work/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/drumbeat",
                "@/modules/drumbeat/**",
                "@/modules/budgeting",
                "@/modules/budgeting/**",
              ],
              message: "work darf nicht aufwärts importieren (ADR-0013).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/drumbeat/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/budgeting", "@/modules/budgeting/**"],
              message: "drumbeat ↮ budgeting (ADR-0013).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/budgeting/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/drumbeat", "@/modules/drumbeat/**"],
              message: "budgeting ↮ drumbeat (ADR-0013).",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
];

export default config;
