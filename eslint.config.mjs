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
                "@/modules/risks",
                "@/modules/risks/**",
                "@/modules/onboarding",
                "@/modules/onboarding/**",
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
                "@/modules/risks",
                "@/modules/risks/**",
                "@/modules/onboarding",
                "@/modules/onboarding/**",
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
              group: [
                "@/modules/budgeting",
                "@/modules/budgeting/**",
                "@/modules/risks",
                "@/modules/risks/**",
                "@/modules/onboarding",
                "@/modules/onboarding/**",
              ],
              message: "drumbeat ↮ budgeting/risks; onboarding ist ein Blatt (ADR-0013/0017).",
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
              group: [
                "@/modules/drumbeat",
                "@/modules/drumbeat/**",
                "@/modules/risks",
                "@/modules/risks/**",
                "@/modules/onboarding",
                "@/modules/onboarding/**",
              ],
              message: "budgeting ↮ drumbeat/risks; onboarding ist ein Blatt (ADR-0013/0017).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/risks/**/*.{ts,tsx}"],
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
                "@/modules/onboarding",
                "@/modules/onboarding/**",
              ],
              message: "risks ↮ drumbeat/budgeting; darf nur work+core importieren (ADR-0013).",
            },
          ],
        },
      ],
    },
  },
  // ── Onboarding (ADR-0017): ein Blatt über Core. Es erklärt die Funktionen der
  //    oberen Module, verweist darauf aber ausschließlich per String (Route,
  //    data-tour-Anker, Capability-Name) — nie per Import. Die Konsistenz dieser
  //    Strings sichern die Tests in domain/__tests__/role-playbook.test.ts.
  {
    files: ["src/modules/onboarding/**/*.{ts,tsx}"],
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
                "@/modules/risks",
                "@/modules/risks/**",
              ],
              message:
                "onboarding liest nur core und verweist auf obere Module per String (ADR-0017).",
            },
          ],
        },
      ],
    },
  },
  // ── Composition-Root (P7 / ADR-0013): Core-Tier-Infra außerhalb von
  //    src/modules (geteilte Nav/Server/Lib/Components) liegt auf Core-Ebene und
  //    darf die Feature-Module (work/drumbeat/budgeting) NICHT importieren.
  //    Modul-übergreifende Kompositionen leben ausschließlich im App-/Route-Shell
  //    (`src/app`) — die einzige Schicht, die mehrere Module verdrahten darf.
  {
    files: [
      "src/features/**/*.{ts,tsx}",
      "src/server/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/i18n/**/*.{ts,tsx}",
      "src/domain/**/*.{ts,tsx}",
    ],
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
                "@/modules/risks",
                "@/modules/risks/**",
                "@/modules/onboarding",
                "@/modules/onboarding/**",
              ],
              message:
                "Core-Tier-Infra darf keine Feature-Module importieren; nur src/app komponiert Module (P7 / ADR-0013).",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
];

export default config;
