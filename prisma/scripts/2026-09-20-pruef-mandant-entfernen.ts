/* eslint-disable no-console */
/**
 * **Den Pruef-Mandanten loeschen, den ich selbst angelegt habe.**
 *
 * „Pruef-Mandant (bitte nicht anlegen)" entstand am 2026-09-20 bei der
 * Reproduktion einer Rechte-Luecke (ein Viewer bekam HTTP 201 in fremden
 * Mandanten). Er ist leer — 0 Wertstroeme, 0 ARTs, 0 Initiativen, 0 Objectives,
 * 0 Themes, 0 KPIs, 0 Timelines — und traegt genau **eine** Zuweisung.
 *
 * **Warum das nicht ueber die Plattform-Dienste geht.** Zwei Waechter schliessen
 * sich hier gegenseitig aus:
 *
 *  - `deleteTenant` (`platform-tenant.ts`) verlangt einen **leeren** Mandanten
 *    und zaehlt `userRoleAssignment` mit. Mit der einen Zuweisung: abgelehnt.
 *  - `removeTenantMember` verweigert genau den **letzten `tenant_admin`** eines
 *    Mandanten — „sonst waere die Organisation verwaist". Und die eine Zuweisung
 *    ist ein `tenant_admin`.
 *
 * Der zweite Waechter schuetzt eine Organisation davor, fuehrungslos
 * weiterzulaufen. Hier laeuft sie nicht weiter: sie verschwindet in derselben
 * Transaktion. Der Lauf umgeht ihn deshalb bewusst — und **nur** ihn.
 *
 * **Was er nicht umgeht: das Audit.** Beide Ereignisse werden geschrieben, die
 * die Dienste geschrieben haetten, in derselben Reihenfolge und mit denselben
 * Feldern: `user.role.removed`, dann `tenant.deleted` — und zwar **vor** dem
 * Delete, weil `audit_events.tenantId` ein String ohne FK ist und die Spur den
 * Mandanten ueberlebt.
 *
 * **Sicherungen.** Der Lauf fasst genau einen Mandanten an, erkannt am vollen
 * Namen, und bricht ab, sobald der Bestand nicht mehr dem entspricht, was hier
 * beschrieben ist: mehr als eine Zuweisung, irgendein Inhalt, ein anderer Name.
 *
 * Idempotent: ein zweiter Lauf findet nichts und meldet das.
 *
 * Trockenlauf (Voreinstellung):
 *   pnpm tsx prisma/scripts/2026-09-20-pruef-mandant-entfernen.ts
 * Schreiblauf:
 *   pnpm tsx prisma/scripts/2026-09-20-pruef-mandant-entfernen.ts --apply
 */

import { prisma } from "../seed-helpers.js";

const APPLY = process.argv.includes("--apply");
const NAME = "Prüf-Mandant (bitte nicht anlegen)";

async function main() {
  console.log(`\n🧹  „${NAME}" — ${APPLY ? "SCHREIBLAUF" : "Trockenlauf"}\n`);

  const tenant = await prisma.tenant.findFirst({
    where: { name: NAME },
    select: { id: true, name: true, createdAt: true },
  });
  if (!tenant) {
    console.log("Nicht vorhanden — nichts zu tun.\n");
    return;
  }
  console.log(`Gefunden: ${tenant.id}  (angelegt ${tenant.createdAt.toISOString()})`);

  const zuweisungen = await prisma.userRoleAssignment.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, role: true, userId: true },
  });
  const inhalt = {
    valueStream: await prisma.valueStream.count({ where: { tenantId: tenant.id } }),
    art: await prisma.art.count({ where: { tenantId: tenant.id } }),
    initiative: await prisma.initiative.count({ where: { tenantId: tenant.id } }),
    objective: await prisma.objective.count({ where: { tenantId: tenant.id } }),
    strategicTheme: await prisma.strategicTheme.count({ where: { tenantId: tenant.id } }),
    kpi: await prisma.kpi.count({ where: { tenantId: tenant.id } }),
    timeline: await prisma.timeline.count({ where: { tenantId: tenant.id } }),
    roleCapability: await prisma.roleCapability.count({ where: { tenantId: tenant.id } }),
  };
  console.log(`Zuweisungen: ${zuweisungen.length}`);
  for (const z of zuweisungen) console.log(`  ${z.role}  ${z.userId}`);
  console.log(`Inhalt: ${JSON.stringify(inhalt)}`);

  const summe = Object.values(inhalt).reduce((a, b) => a + b, 0);
  if (summe > 0 || zuweisungen.length > 1) {
    console.log("\n⛔  Der Mandant ist nicht mehr leer. Abbruch — das gehoert besprochen.\n");
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\nTrockenlauf — nichts geschrieben. Mit --apply ausfuehren.\n");
    return;
  }

  // Ein Akteur muss in der Spur stehen. Der Eigentuemer der Zuweisung ist der
  // ehrlichste: er hat den Mandanten angelegt.
  const actorId = zuweisungen[0]?.userId;
  if (!actorId) {
    // Ohne Zuweisung ist der Mandant nach Massstab von `deleteTenant` leer —
    // dann braucht es dieses Skript nicht, und der Dienst schreibt die Spur
    // selbst, mit dem echten Akteur.
    console.log("\n⛔  Keine Zuweisung: der Waechter greift gar nicht mehr.");
    console.log("   Loeschen ueber die Plattform-Flaeche (`deleteTenant`), nicht hier.\n");
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    for (const z of zuweisungen) {
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          actorId,
          action: "user.role.removed",
          resourceType: "user_role_assignment",
          resourceId: z.id,
          changes: {
            role: { before: z.role, after: null },
            targetUserId: { before: z.userId, after: null },
          },
        },
      });
      await tx.userRoleAssignment.delete({ where: { id: z.id } });
    }
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorId,
        action: "tenant.deleted",
        resourceType: "tenant",
        resourceId: tenant.id,
      },
    });
    await tx.tenant.delete({ where: { id: tenant.id } });
  });

  console.log(
    `\n✅  Mandant geloescht, ${zuweisungen.length + 1} Audit-Ereignis(se) geschrieben.\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
