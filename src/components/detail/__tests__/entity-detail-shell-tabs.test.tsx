import { describe, it, expect, vi } from "vitest";

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
