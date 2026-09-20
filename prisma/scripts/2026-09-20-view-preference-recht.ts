/* eslint-disable no-console */
/**
 * **Das neue Recht `view_preference.manage` in den Bestand nachziehen.**
 *
 * `resolveCapabilities()` (`principal.ts`) liest `role_capabilities` und faellt
 * **nur dann** auf die Code-Vorgaben zurueck, wenn ein Mandant fuer die Rollen
 * des Principals gar keine Zeile hat — alles oder nichts. Eine **neue** Action
 * existiert in einem Bestandsmandanten damit schlicht nicht: die Kachel wuerde
 * ihre Einstellung still nicht speichern, ohne dass irgendwo etwas rot wird.
 *
 * Genau dieselbe Falle hat heute schon zweimal zugeschlagen (der Wertstrom-Scope
 * beim ART-Budget, der ART-Scope an den Feature-Rechten). Sie gehoert zu **jeder**
 * neuen Action, nicht nur zu dieser.
 *
 * **Bewusst eng:** nur `view_preference.manage`, nicht der ganze Katalog. Ein
 * voller Abgleich schriebe unangekuendigt jede Capability jedes Mandanten um.
 * Mandanten **ohne** eigene Zeilen bleiben unberuehrt — sie lesen ohnehin den
 * Code-Default und sind damit schon richtig.
 *
 * Die Vorgabe kommt aus `enumerateDefaultCapabilities()`, nicht aus einer Liste
 * in diesem Skript: die Wahrheit steht im Code.
 *
 * Idempotent: ein zweiter Lauf meldet 0 Aenderungen.
 *
 * Trockenlauf (Voreinstellung):
 *   pnpm tsx prisma/scripts/2026-09-20-view-preference-recht.ts
 * Schreiblauf:
 *   pnpm tsx prisma/scripts/2026-09-20-view-preference-recht.ts --apply
 */

import { prisma } from "../seed-helpers.js";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";

const APPLY = process.argv.includes("--apply");
const ACTION = "view_preference.manage";

async function main() {
  console.log(`\n👁  ${ACTION} nachziehen — ${APPLY ? "SCHREIBLAUF" : "Trockenlauf"}\n`);

  const soll = enumerateDefaultCapabilities().filter((c) => c.action === ACTION);
  if (soll.length === 0) {
    console.log(`⛔  ${ACTION} steht in keiner POLICIES-Zeile. Abbruch.\n`);
    process.exit(1);
  }
  console.log(`Vorgabe aus POLICIES: ${soll.length} Rolle(n), scope=${soll[0]!.scope ?? "(kein)"}`);

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const namen = new Map(tenants.map((t) => [t.id, t.name]));
  const mitZeilen = new Set(
    (await prisma.roleCapability.findMany({ select: { tenantId: true } })).map((r) => r.tenantId),
  );
  const bestand = await prisma.roleCapability.findMany({
    where: { action: ACTION },
    select: { tenantId: true, role: true },
  });
  const vorhanden = new Set(bestand.map((r) => `${r.tenantId}|${r.role}`));

  const anzulegen: { tenantId: string; role: string; scope: string | null }[] = [];
  for (const tenantId of mitZeilen) {
    for (const c of soll) {
      if (!vorhanden.has(`${tenantId}|${c.role}`)) {
        anzulegen.push({ tenantId, role: c.role, scope: c.scope });
      }
    }
  }

  console.log(`\nMandanten mit eigenen Zeilen: ${mitZeilen.size} von ${tenants.length}`);
  console.log(`Zeilen anzulegen: ${anzulegen.length}`);
  const jeMandant = new Map<string, number>();
  for (const a of anzulegen) jeMandant.set(a.tenantId, (jeMandant.get(a.tenantId) ?? 0) + 1);
  for (const [tenantId, n] of jeMandant) {
    console.log(`  + ${(namen.get(tenantId) ?? tenantId).padEnd(24)} ${n} Rolle(n)`);
  }

  if (!APPLY) {
    console.log(`\nTrockenlauf — nichts geschrieben. Mit --apply ausfuehren.\n`);
    return;
  }
  if (anzulegen.length === 0) {
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

  const res = await prisma.roleCapability.createMany({
    data: anzulegen.map((a) => ({
      tenantId: a.tenantId,
      role: a.role,
      action: ACTION,
      scope: a.scope,
      createdBy: admins.get(a.tenantId)!,
    })),
    skipDuplicates: true,
  });
  console.log(`\n✅  ${res.count} Zeile(n) angelegt.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
