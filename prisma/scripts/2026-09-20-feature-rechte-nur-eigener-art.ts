/* eslint-disable no-console */
/**
 * **Die Feature-Rechte gelten nur im eigenen ART — und der Feature Owner darf
 * loeschen.**
 *
 * Zwei Dinge in einem Lauf, weil sie dieselben vier Zeilen betreffen:
 *
 *  - **Der ART-Scope.** `feature.create` und `feature.update` wurden im
 *    September 2026 fuer RTE und Feature Owner `art`-scoped; `feature.delete`
 *    stand abgesetzt ueber dem Feature-Block und rutschte durch. Seit dem
 *    2026-09-20 traegt auch sie den Scope.
 *  - **Das Loeschrecht des Feature Owners.** Es ist neu. In `role_capabilities`
 *    gibt es dafuer heute in **keinem** Mandanten eine Zeile — sie muss
 *    angelegt werden, sonst bekommt er das Recht nirgends.
 *
 * **Warum es ueberhaupt einen Lauf braucht:** `resolveCapabilities()` liest
 * `role_capabilities` und faellt **nur dann** auf den Code-Default zurueck, wenn
 * der Mandant fuer die Rollen des Principals gar keine Zeile hat — alles oder
 * nichts. Jeder Bestandsmandant hat Zeilen. Gemessen am 2026-09-20 trugen nur
 * Pulse Demo Corp und Large Test Corp den Scope fuer create/update (sie wurden
 * neu geseedet und spiegeln damit `enumerateDefaultCapabilities()`); Large Setup
 * Corp, Simulation Test Corp und Test Demo trugen ihn in **keiner** der drei
 * Aktionen.
 *
 * **Bewusst eng:** der Lauf gleicht nur die `feature.*`-Zeilen gegen die
 * Code-Vorgaben ab, nicht den ganzen Katalog. Ein voller Abgleich schriebe
 * unangekuendigt jede Capability jedes Mandanten um — das waere ein anderer,
 * viel groesserer Zug.
 *
 * Mandanten **ohne** `role_capabilities`-Zeilen bleiben unberuehrt: sie fallen
 * ohnehin auf den Code-Default zurueck und sind damit schon richtig.
 *
 * Idempotent: ein zweiter Lauf meldet 0 Aenderungen.
 *
 * Trockenlauf (Voreinstellung):
 *   pnpm tsx prisma/scripts/2026-09-20-feature-rechte-nur-eigener-art.ts
 * Schreiblauf:
 *   pnpm tsx prisma/scripts/2026-09-20-feature-rechte-nur-eigener-art.ts --apply
 */

import { prisma } from "../seed-helpers.js";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";

const APPLY = process.argv.includes("--apply");
const ACTIONS = ["feature.create", "feature.update", "feature.delete"] as const;

async function main() {
  console.log(`\n🔐  Feature-Rechte je ART — ${APPLY ? "SCHREIBLAUF" : "Trockenlauf"}\n`);

  // Die Wahrheit steht im Code, nicht in diesem Skript: dieselbe Funktion, aus
  // der die Seeds ihre Zeilen ableiten.
  const soll = enumerateDefaultCapabilities().filter((c) =>
    (ACTIONS as readonly string[]).includes(c.action),
  );
  console.log("Vorgabe aus POLICIES:");
  for (const c of soll) {
    console.log(`  ${c.action.padEnd(16)} ${c.role.padEnd(18)} scope=${c.scope ?? "(kein)"}`);
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const namen = new Map(tenants.map((t) => [t.id, t.name]));

  // Nur Mandanten, die ueberhaupt eigene Zeilen fuehren — die uebrigen lesen
  // den Code-Default.
  const mitZeilen = new Set(
    (await prisma.roleCapability.findMany({ select: { tenantId: true } })).map((r) => r.tenantId),
  );
  const bestand = await prisma.roleCapability.findMany({
    where: { action: { in: [...ACTIONS] } },
    select: { id: true, tenantId: true, role: true, action: true, scope: true },
  });
  const key = (t: string, r: string, a: string) => `${t}|${r}|${a}`;
  const vorhanden = new Map(bestand.map((r) => [key(r.tenantId, r.role, r.action), r]));

  const zuAendern: { id: string; von: string | null; nach: string | null; wo: string }[] = [];
  const anzulegen: { tenantId: string; role: string; action: string; scope: string | null }[] = [];

  for (const tenantId of mitZeilen) {
    for (const c of soll) {
      const treffer = vorhanden.get(key(tenantId, c.role, c.action));
      const wo = `${(namen.get(tenantId) ?? tenantId).padEnd(22)} ${c.action.padEnd(16)} ${c.role}`;
      if (!treffer) {
        anzulegen.push({ tenantId, role: c.role, action: c.action, scope: c.scope });
      } else if (treffer.scope !== c.scope) {
        zuAendern.push({ id: treffer.id, von: treffer.scope, nach: c.scope, wo });
      }
    }
  }

  console.log(`\nMandanten mit eigenen Zeilen: ${mitZeilen.size} von ${tenants.length}`);
  console.log(`Scope zu korrigieren: ${zuAendern.length}`);
  for (const z of zuAendern) {
    console.log(`  → ${z.wo}   ${z.von ?? "(kein)"} → ${z.nach ?? "(kein)"}`);
  }
  console.log(`Zeilen anzulegen: ${anzulegen.length}`);
  for (const a of anzulegen) {
    console.log(
      `  + ${(namen.get(a.tenantId) ?? a.tenantId).padEnd(22)} ${a.action.padEnd(16)} ${a.role}  scope=${a.scope ?? "(kein)"}`,
    );
  }

  // **Die Wirkung, gezaehlt statt behauptet.** Ein `art`-Scope greift nur, wenn
  // die Zuweisung ARTs nennt: `memberOrVacuous` liest eine leere Liste als
  // „alles in Reichweite". Das ist bestehende Semantik und wird hier NICHT
  // angefasst — aber es soll im Protokoll stehen.
  const zuweisungen = await prisma.userRoleAssignment.findMany({
    where: { role: { in: ["rte", "feature_owner"] } },
    select: { tenantId: true, role: true, artIds: true },
  });
  const artsJeMandant = new Map<string, number>();
  for (const a of await prisma.art.findMany({ select: { tenantId: true } })) {
    artsJeMandant.set(a.tenantId, (artsJeMandant.get(a.tenantId) ?? 0) + 1);
  }
  let ohneScope = 0;
  console.log(`\nReichweite der ${zuweisungen.length} Zuweisungen (ARTs):`);
  for (const z of zuweisungen) {
    const alle = artsJeMandant.get(z.tenantId) ?? 0;
    const nachher = z.artIds.length === 0 ? alle : z.artIds.length;
    if (z.artIds.length === 0) ohneScope++;
    console.log(
      `  ${(namen.get(z.tenantId) ?? z.tenantId).padEnd(22)} ${z.role.padEnd(14)} ${String(alle).padStart(3)} → ${String(nachher).padStart(3)}${z.artIds.length === 0 ? "  ⚠ ohne ART-Zuweisung" : ""}`,
    );
  }
  if (ohneScope > 0) {
    console.log(
      `\n⚠  ${ohneScope} Zuweisung(en) ohne ART: fuer sie aendert sich nichts, weil eine leere`,
    );
    console.log('   Scope-Liste in authorize() „alles in Reichweite" heisst.');
  }

  if (!APPLY) {
    console.log(`\nTrockenlauf — nichts geschrieben. Mit --apply ausfuehren.\n`);
    return;
  }
  if (zuAendern.length === 0 && anzulegen.length === 0) {
    console.log(`\nNichts zu tun.\n`);
    return;
  }

  // `createdBy` ist Pflicht. Der erste Tenant-Admin des Mandanten ist der
  // ehrlichste Akteur — dieselbe Wahl wie in den Seeds.
  const admins = new Map<string, string>();
  for (const a of await prisma.userRoleAssignment.findMany({
    where: { role: "tenant_admin" },
    select: { tenantId: true, userId: true },
  })) {
    if (!admins.has(a.tenantId)) admins.set(a.tenantId, a.userId);
  }
  const ohneAdmin = anzulegen.filter((a) => !admins.has(a.tenantId));
  if (ohneAdmin.length > 0) {
    console.log(`\n⛔  ${ohneAdmin.length} Zeile(n) ohne Tenant-Admin als Akteur. Abbruch.\n`);
    process.exit(1);
  }

  let geaendert = 0;
  for (const z of zuAendern) {
    await prisma.roleCapability.update({ where: { id: z.id }, data: { scope: z.nach } });
    geaendert++;
  }
  const erstellt = await prisma.roleCapability.createMany({
    data: anzulegen.map((a) => ({
      tenantId: a.tenantId,
      role: a.role,
      action: a.action,
      scope: a.scope,
      createdBy: admins.get(a.tenantId)!,
    })),
    skipDuplicates: true,
  });
  console.log(`\n✅  ${geaendert} Scope(s) korrigiert, ${erstellt.count} Zeile(n) angelegt.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
