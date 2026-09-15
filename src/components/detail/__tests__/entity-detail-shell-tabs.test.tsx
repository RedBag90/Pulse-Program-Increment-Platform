import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { filesUnder } from "@/test/helpers/visual-language";

// Die Schale ist eine Client-Komponente; `resolveTab` daraus ist rein. Der
// Link-Import würde next-intl mitziehen, das die Testumgebung nicht auflöst.
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import { resolveTab } from "@/components/detail/entity-detail-shell";

/**
 * Der Fehler, den dieser Test festhält: `basePath` trug eine Query, und die
 * Schale hängt selbst `?tab=` an — daraus wurde
 * `…?cycle=2026-H2?tab=betrieb`. Der Reiter-Parameter kam nie an, `resolveTab`
 * fiel immer auf den ersten Reiter zurück, und der Klick tat sichtbar nichts.
 *
 * Zusätzliche Parameter gehören deshalb in `tabQuery`, nicht in `basePath`.
 */

const TABS = [
  { key: "budget", label: "Budget" },
  { key: "betrieb", label: "Run the Business" },
] as const;

/** Nachbau der Link-Erzeugung der Schale. */
function tabHref(basePath: string, key: string, tabQuery?: Record<string, string>): string {
  const suffix = Object.entries(tabQuery ?? {})
    .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
    .join("");
  return `${basePath}?tab=${key}${suffix}`;
}

/** Was Next aus dem Link als `?tab=` herauslesen würde. */
const tabParam = (href: string) => new URL(href, "https://x").searchParams.get("tab");

describe("Reiter-Links der Detail-Schale", () => {
  it("trägt den Reiter, wenn zusätzliche Parameter über tabQuery kommen", () => {
    const href = tabHref("/budgeting/value-streams/v1", "betrieb", { cycle: "2026-H2" });
    expect(href).toBe("/budgeting/value-streams/v1?tab=betrieb&cycle=2026-H2");
    expect(tabParam(href)).toBe("betrieb");
    expect(resolveTab(TABS, tabParam(href) ?? undefined)).toBe("betrieb");
  });

  it("verliert den Reiter, wenn die Query im basePath steckt — der gemeldete Fehler", () => {
    const href = tabHref("/budgeting/value-streams/v1?cycle=2026-H2", "betrieb");
    expect(tabParam(href)).not.toBe("betrieb");
    // Und genau deshalb landete der Klick immer wieder auf dem ersten Reiter.
    expect(resolveTab(TABS, tabParam(href) ?? undefined)).toBe("budget");
  });
});

/**
 * **Ein Reitername muss in die Schiene passen.**
 *
 * Auf der Epic-Detailseite standen drei Etiketten, die hart abgeschnitten
 * wurden — „Reifegrad-Phasen und T", „Business case calculatio". Kein
 * Auslassungszeichen, kein Tooltip: der Name hörte mitten im Wort auf. Die
 * Schale kürzt seitdem mit `lg:truncate`, aber ein „…" ist die Notbremse,
 * nicht das Ziel. Der Name selbst soll passen.
 *
 * Das Maß kommt aus der Schale (`entity-detail-shell.tsx`) und steht hier,
 * damit eine künftige Verbreiterung der Schiene die Schranke mitzieht, statt
 * sie zu einer Lüge zu machen:
 *
 * ```
 *   lg:w-48                                    192 px
 * − lg:p-3        (Innenabstand der Schiene)  − 24 px
 * − px-3          (Innenabstand der Fläche)   − 24 px
 * − lg:border-r + lg:border-l-2               −  3 px
 * = ~141 px  ≈ 20 Zeichen bei text-sm
 * ```
 *
 * Gemessen wird am Quelltext, nicht an importierten Konstanten: die Hälfte der
 * Reitersätze steht als `const TABS` in einer `page.tsx` und lässt sich in
 * einem Unit-Test nicht laden. Dieselbe Haltung wie bei `visualViolations` —
 * wer eine neue Fläche baut, wird gemessen, ohne sich eintragen zu müssen.
 */
const REITER_ZEICHEN_MAX = 20;

/**
 * Die Reiterform `{ key: "…", label: "…" }`.
 *
 * Sie allein reicht **nicht** als Kennzeichen: dieselbe Form tragen auch die
 * Gate-Kriterien (`work/domain/solution.ts`) und die Rollenliste
 * (`server/views/admin-roles.ts`), und beide dürfen so lang sein, wie sie
 * müssen — sie stehen nirgends in einer 141 px breiten Schiene. Der erste
 * Durchgang dieses Wächters hat sie gemeldet; das war seine Messung, nicht
 * ihr Fehler.
 *
 * Deshalb wird vorher auf Dateien gefiltert, die überhaupt eine Reiterleiste
 * bauen. Brotkrumen (`{ label, href }`) trifft das Muster ohnehin nicht.
 */
const REITER_PAAR = /key:\s*"[^"]*",\s*label:\s*"([^"]+)"/g;

/** Baut diese Datei eine Reiterleiste? Nur dann gilt die Schienenbreite. */
const BAUT_REITER = /\bDetailTab\b|\btabs=\{/;

describe("Reiternamen passen in die Schiene", () => {
  it(`hält jedes Etikett bei höchstens ${REITER_ZEICHEN_MAX} Zeichen`, () => {
    const zuLang: string[] = [];
    for (const datei of filesUnder(join(process.cwd(), "src"))) {
      const src = readFileSync(datei, "utf8");
      if (!BAUT_REITER.test(src)) continue;
      for (const m of src.matchAll(REITER_PAAR)) {
        const label = m[1];
        if (label === undefined || label.length <= REITER_ZEICHEN_MAX) continue;
        const zeile = src.slice(0, m.index ?? 0).split("\n").length;
        const rel = datei.replace(/^.*\/src\//, "src/");
        zuLang.push(`  · ${rel}:${zeile}  „${label}" — ${label.length} Zeichen`);
      }
    }
    expect(zuLang, `Reiternamen über der Schienenbreite:\n${zuLang.join("\n")}`).toEqual([]);
  });
});
