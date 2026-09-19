import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filesUnder } from "@/test/helpers/visual-language";
import {
  clientValueImports,
  formatClientValueImports,
  isClientModule,
  valueExports,
} from "@/test/helpers/client-value-imports";

/**
 * **Die Grenze, die TypeScript nicht sieht.**
 *
 * Eine Server-Komponente, die eine Konstante aus einem `"use client"`-Modul
 * liest, bekommt `undefined` — erst zur Laufzeit, erst im echten Rendern.
 * `tsc` ist zufrieden, `next build` auch, und ein jsdom-Test ebenfalls: der
 * rendert clientseitig, wo das Modul normal auflöst. Gefunden wurde es erst im
 * Browser, mit einem Absturz auf `HORIZON_BADGE_CLASS[h].dot`.
 *
 * Der Wächter prüft sich zuerst selbst: ein Melder, der nichts findet, ist von
 * einem sauberen Baum nicht zu unterscheiden.
 */
const SRC = join(process.cwd(), "src");

describe("der Melder selbst", () => {
  const client = `"use client";
export const HORIZON_BADGE_CLASS = { h1: { dot: "x" } };
export const helferChen = 1;
export function HorizonBadge() { return null; }
export const HorizonPill = () => null;
export type Horizon = "h1";
`;

  it("erkennt ein Client-Modul — auch hinter einem Kommentar", () => {
    expect(isClientModule(client)).toBe(true);
    expect(isClientModule('// Kopfzeile\n"use client";\n')).toBe(true);
    expect(isClientModule('import x from "y";\n')).toBe(false);
  });

  it("hält Komponenten für Komponenten und Konstanten für Werte", () => {
    expect([...valueExports(client)].sort()).toEqual(["HORIZON_BADGE_CLASS", "helferChen"]);
  });

  it("meldet den Wert-Import aus einer Server-Datei", () => {
    const rows = clientValueImports(
      new Map([
        ["src/features/badge", client],
        [
          "src/app/de/page",
          `import { HORIZON_BADGE_CLASS } from "@/features/badge";\nexport default function P() { return null; }`,
        ],
      ]),
    );
    expect(rows).toEqual([
      { file: "src/app/de/page", from: "src/features/badge", name: "HORIZON_BADGE_CLASS" },
    ]);
    expect(formatClientValueImports(rows)).toContain("HORIZON_BADGE_CLASS");
  });

  it("schweigt bei einer Komponente, einem Typ-Import und einem Client-Leser", () => {
    const rows = clientValueImports(
      new Map([
        ["src/features/badge", client],
        ["src/app/a/page", `import { HorizonBadge } from "@/features/badge";`],
        ["src/app/b/page", `import type { Horizon } from "@/features/badge";`],
        [
          "src/app/c/page",
          `"use client";\nimport { HORIZON_BADGE_CLASS } from "@/features/badge";`,
        ],
      ]),
    );
    expect(rows).toEqual([]);
  });

  /**
   * Der Fall, an dem der Melder erst scheiterte: eine Datei ohne Direktive, die
   * **nur** von einer Client-Komponente gelesen wird, liegt im Client-Bündel
   * und löst dort normal auf. Genau so steht `breakdown-layout.ts` im Repo.
   */
  it("schweigt bei einer Datei, die der Server gar nicht lädt", () => {
    const rows = clientValueImports(
      new Map([
        ["src/features/badge", client],
        ["src/features/layout", `import { HORIZON_BADGE_CLASS } from "@/features/badge";`],
        ["src/features/view", `"use client";\nimport x from "@/features/layout";`],
        ["src/app/page", `import { View } from "@/features/view";`],
      ]),
    );
    expect(rows).toEqual([]);
  });

  it("folgt dem Importgraphen über mehrere Stufen", () => {
    const rows = clientValueImports(
      new Map([
        ["src/features/badge", client],
        ["src/server/tief", `import { HORIZON_BADGE_CLASS } from "@/features/badge";`],
        ["src/server/mitte", `import x from "@/server/tief";`],
        ["src/app/page", `import y from "@/server/mitte";`],
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(["src/server/tief"]);
  });
});

describe("keine Server-Datei liest einen Wert aus einem Client-Modul", () => {
  const files = new Map<string, string>();
  for (const abs of filesUnder(SRC)) {
    const rel = abs.slice(abs.indexOf("/src/") + 1).replace(/\.(tsx?|jsx?)$/, "");
    if (rel.startsWith("src/generated/") || rel.startsWith("src/test/")) continue;
    files.set(rel, readFileSync(abs, "utf8"));
  }

  it("misst den gesamten Quellbaum", () => {
    expect(files.size).toBeGreaterThan(500);
  });

  it("findet keinen Verstoß", () => {
    const rows = clientValueImports(files);
    expect(
      rows,
      rows.length === 0 ? "" : `\n${rows.length} Verstöße:\n${formatClientValueImports(rows)}\n`,
    ).toEqual([]);
  });
});
