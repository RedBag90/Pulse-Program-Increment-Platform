import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import de from "../../../../messages/de.json";
import en from "../../../../messages/en.json";

/**
 * **Wer ein Auth-Konto löschen darf — und wer nicht mehr.**
 *
 * `eraseUserAction` (`features/admin/actions/gdpr.ts`) nimmt eine beliebige
 * `userId` und prueft `tenant.users.manage` **im eigenen** Mandanten. Ob der
 * Zielnutzer dort Mitglied ist, prueft niemand: `eraseUserRecords` lief fuer
 * einen Fremden ins Leere, `admin.auth.admin.deleteUser(userId)` lief trotzdem.
 * Und weil jeder in seinem „Mein Bereich" `tenant_admin` ist, passierte **jeder
 * eingeloggte Nutzer** den Fast-Path in `authorize()` — wer eine fremde UUID
 * kannte, loeschte das Konto.
 *
 * Geschlossen wurde das, indem der Aufruf **verschwand**, nicht indem eine
 * Pruefung davorkam. Eine entfernte Schaltflaeche schuetzt keine Server-Action;
 * ein entfernter Aufruf schon. Deshalb prueft dieser Test den Quelltext: es gibt
 * nichts mehr aufzurufen. Dieselbe Bauart wie die Seed-Riegel in
 * `feature-reifegrad.test.ts`.
 */

const lies = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * **Ohne Kommentare.** Geprueft wird, was die Datei *tut* — und ihre Docblocks
 * erzaehlen die Geschichte des Lochs, `admin.auth.admin.deleteUser` eingeschlossen.
 * Ein Test, der daran anschlaegt, verbietet das Erklaeren statt das Aufrufen.
 */
const nurCode = (rel: string) =>
  lies(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("die Mandanten-Verwaltung fasst keine Auth-Konten an", () => {
  const gdpr = nurCode("src/features/admin/actions/gdpr.ts");

  it("ruft die Supabase-Admin-API nicht", () => {
    expect(gdpr).not.toContain("deleteUser");
    expect(gdpr).not.toContain("createAdminClient");
  });

  it("entzieht weiterhin Zugang und Datensaetze im eigenen Mandanten", () => {
    // Der Entzug gehoert dem Mandanten und bleibt. Nur das Konto nicht.
    expect(gdpr).toContain("eraseUserRecords");
  });

  it("die Beschriftung verspricht nichts, was die Action nicht tut", () => {
    // Der Wortlaut steht seit der Katalog-Umstellung nicht mehr im Knopf,
    // sondern hinter seinem Schlüssel — geprüft wird, was er anzeigt.
    const knopf = nurCode("src/features/admin/components/erase-user-button.tsx");
    expect(knopf).toContain('t("admin.ui.zugangEntziehenDsgvo")');
    expect(de.admin.ui.zugangEntziehenDsgvo).toContain("Zugang entziehen");
    expect(en.admin.ui.zugangEntziehenDsgvo).not.toMatch(/erase|delete/i);
  });
});

describe("die Plattform-Verwaltung fasst sie an", () => {
  const platform = nurCode("src/server/services/platform-user.ts");
  const fn = platform.slice(platform.indexOf("export async function deleteUserAccount"));

  it("loescht das Konto", () => {
    expect(fn).toContain("admin.auth.admin.deleteUser");
  });

  it("hinter dem Plattform-Waechter", () => {
    expect(fn.slice(0, 400)).toContain("assertPlatformAdmin(actor)");
  });

  it("und verweigert die Selbstloeschung", () => {
    expect(fn.slice(0, 600)).toContain("userId === actor.id");
  });

  it("die Server-Action dazu prueft denselben Waechter", () => {
    const action = nurCode("src/features/platform/actions/user-actions.ts");
    const a = action.slice(action.indexOf("export async function deleteUserAccountAction"));
    expect(a).toContain("requirePlatformAdmin()");
  });
});
