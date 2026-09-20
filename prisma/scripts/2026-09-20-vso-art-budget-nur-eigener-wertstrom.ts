/* eslint-disable no-console */
/**
 * **Der Wertstrom-Owner verteilt nur in seinem eigenen Strom.**
 *
 * `art_budget.distribute` trug fuer `value_stream_owner` bis September 2026
 * **keinen** Scope. Er durfte damit in fremden Wertstroemen verteilen, und
 * `/my-tasks` schickte ihm die Foerder-Erinnerung fuer **jedes** ART des
 * Mandanten — der unscoped-Zweig dort ist fuer Admin und Portfolio-Management
 * gedacht. `POLICIES` ist korrigiert; dieses Skript zieht den Bestand nach.
 *
 * **Warum es ueberhaupt eines braucht:** `resolveCapabilities()` liest die
 * Tabelle `role_capabilities` und faellt **nur dann** auf den Code-Default
 * zurueck, wenn der Mandant fuer die Rollen des Principals gar keine Zeile hat
 * — alles oder nichts. Jeder Bestandsmandant hat Zeilen. Die Aenderung an
 * `POLICIES` ist ohne diesen Lauf also **wirkungslos**; gemessen am 2026-09-20
 * stand der Scope in allen fuenf Mandanten auf `NULL`.
 *
 * Beruehrt **nur** `(role = value_stream_owner, action = art_budget.distribute)`
 * und setzt dort `scope = 'value_stream'`. Zeilen anderer Rollen bleiben
 * unangetastet: der RTE behaelt `art`, Admin und Portfolio-Management behalten
 * ihren fehlenden Scope — beides ist so gewollt.
 *
 * **Was der Lauf nicht kann:** eine leere Scope-Liste an der Zuweisung heisst in
 * `authorize()` „alles in Reichweite" (`memberOrVacuous`). Wer als
 * Wertstrom-Owner keinen Wertstrom zugewiesen bekommen hat, darf danach
 * weiterhin ueberall verteilen. Das Skript meldet diese Zuweisungen, damit die
 * Luecke sichtbar ist, und aendert sie nicht — welcher Strom gemeint ist, weiss
 * es nicht.
 *
 * Idempotent: ein zweiter Lauf meldet 0 Aenderungen.
 *
 * Trockenlauf (Voreinstellung):
 *   pnpm tsx prisma/scripts/2026-09-20-vso-art-budget-nur-eigener-wertstrom.ts
 * Schreiblauf:
 *   pnpm tsx prisma/scripts/2026-09-20-vso-art-budget-nur-eigener-wertstrom.ts --apply
 */

import { prisma } from "../seed-helpers.js";

const APPLY = process.argv.includes("--apply");
const ROLE = "value_stream_owner";
const ACTION = "art_budget.distribute";

async function main() {
  console.log(
    `\n💶  ${ROLE} · ${ACTION} → scope=value_stream — ${APPLY ? "SCHREIBLAUF" : "Trockenlauf"}\n`,
  );

  const rows = await prisma.roleCapability.findMany({
    where: { role: ROLE, action: ACTION },
    select: { id: true, tenantId: true, scope: true },
  });
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const namen = new Map(tenants.map((t) => [t.id, t.name]));

  const zuAendern = rows.filter((r) => r.scope !== "value_stream");
  console.log(`Zeilen gesamt: ${rows.length} — davon ohne value_stream-Scope: ${zuAendern.length}`);
  for (const r of rows) {
    const mark = r.scope === "value_stream" ? "  " : "→ ";
    console.log(
      `  ${mark}${(namen.get(r.tenantId) ?? r.tenantId).padEnd(24)} scope=${r.scope ?? "(kein)"}`,
    );
  }

  // Wie viele ARTs ein Wertstrom-Owner danach noch sieht — die eigentliche
  // Wirkung, gezaehlt statt behauptet.
  const zuweisungen = await prisma.userRoleAssignment.findMany({
    where: { role: ROLE },
    select: { userId: true, tenantId: true, valueStreamIds: true },
  });
  const artsJeMandant = new Map<string, number>();
  const artsJeStrom = new Map<string, number>();
  for (const a of await prisma.art.findMany({ select: { tenantId: true, valueStreamId: true } })) {
    artsJeMandant.set(a.tenantId, (artsJeMandant.get(a.tenantId) ?? 0) + 1);
    artsJeStrom.set(a.valueStreamId, (artsJeStrom.get(a.valueStreamId) ?? 0) + 1);
  }

  console.log(`\nReichweite der ${zuweisungen.length} Zuweisungen (ARTs in der Erinnerung):`);
  let ohneScope = 0;
  for (const z of zuweisungen) {
    const alle = artsJeMandant.get(z.tenantId) ?? 0;
    if (z.valueStreamIds.length === 0) {
      ohneScope++;
      console.log(
        `  ${(namen.get(z.tenantId) ?? z.tenantId).padEnd(24)} ${String(alle).padStart(3)} → ${String(alle).padStart(3)}  ⚠ ohne Wertstrom-Zuweisung`,
      );
    } else {
      const nachher = z.valueStreamIds.reduce((n, vs) => n + (artsJeStrom.get(vs) ?? 0), 0);
      console.log(
        `  ${(namen.get(z.tenantId) ?? z.tenantId).padEnd(24)} ${String(alle).padStart(3)} → ${String(nachher).padStart(3)}`,
      );
    }
  }
  if (ohneScope > 0) {
    console.log(
      `\n⚠  ${ohneScope} Zuweisung(en) ohne Wertstrom: fuer sie aendert sich nichts, weil eine leere`,
    );
    console.log('   Scope-Liste in authorize() „alles in Reichweite" heisst. Das ist bestehende');
    console.log("   Semantik und wird hier bewusst NICHT angefasst.");
  }

  if (!APPLY) {
    console.log(`\nTrockenlauf — nichts geschrieben. Mit --apply ausfuehren.\n`);
    return;
  }
  if (zuAendern.length === 0) {
    console.log(`\nNichts zu tun.\n`);
    return;
  }
  const res = await prisma.roleCapability.updateMany({
    where: { id: { in: zuAendern.map((r) => r.id) } },
    data: { scope: "value_stream" },
  });
  console.log(`\n✅  ${res.count} Zeile(n) auf scope=value_stream gesetzt.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
