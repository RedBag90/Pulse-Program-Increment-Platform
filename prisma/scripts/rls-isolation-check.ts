/* eslint-disable no-console */
/**
 * Beweist die Mandanten-Isolation — in **beide** Richtungen.
 *
 * Der gefährliche Fehlermodus bei RLS ist nicht der laute, sondern der leise:
 * eine zu enge Policy liefert leere Listen statt eines Fehlers, und die
 * Anwendung sieht monatelang gesund aus. Deshalb prüft dieses Skript beides:
 *
 *   1. **Der eigene Mandant sieht alles** — sonst ist die Policy zu eng.
 *   2. **Ein fremder Mandant sieht nichts** — sonst schützt sie nicht.
 *
 * Es misst dazu die Laufzeit mit und ohne Claim-Mechanismus, weil genau diese
 * Kosten der Grund waren, ihn auszubauen.
 *
 * Rein lesend. Aufruf:
 *   set -a; . ./.env.local; set +a
 *   PULSE_RLS_CLAIMS=1 pnpm tsx prisma/scripts/rls-isolation-check.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { createPrismaClient, RLS_CLAIMS_ENABLED } from "@/server/db/prisma";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

/** Tabellen, an denen die Prüfung hängt — je eine je Policy-Bauart. */
const PROBES = [
  {
    label: "initiatives (direkt)",
    read: (db: PrismaClient, t: string) => db.initiative.count({ where: { tenantId: t } }),
  },
  {
    label: "budget_rounds (direkt)",
    read: (db: PrismaClient, t: string) => db.budgetRound.count({ where: { tenantId: t } }),
  },
  {
    label: "budget_groups (über round)",
    read: (db: PrismaClient, t: string) =>
      db.budgetGroup.count({ where: { round: { tenantId: t } } }),
  },
  {
    label: "group_allocations (über round)",
    read: (db: PrismaClient, t: string) =>
      db.groupAllocation.count({ where: { round: { tenantId: t } } }),
  },
  {
    label: "art_epic_allocations (direkt)",
    read: (db: PrismaClient, t: string) => db.artEpicAllocation.count({ where: { tenantId: t } }),
  },
] as const;

async function main(): Promise<void> {
  const admin = new PrismaClient();
  const tenants = await admin.tenant.findMany({ select: { id: true, name: true }, take: 20 });
  if (tenants.length < 2) {
    console.log("Weniger als zwei Mandanten — die Isolation ist so nicht prüfbar.");
    await admin.$disconnect();
    return;
  }

  // Zwei Mandanten mit Daten, sonst beweist ein leeres Ergebnis nichts.
  const withData: { id: string; name: string; n: number }[] = [];
  for (const t of tenants) {
    const n = await admin.initiative.count({ where: { tenantId: t.id } });
    if (n > 0) withData.push({ ...t, n });
    if (withData.length === 2) break;
  }
  if (withData.length < 2) {
    console.log(
      "Weniger als zwei Mandanten mit Daten — ein leeres Ergebnis wäre nicht aussagekräftig.",
    );
    await admin.$disconnect();
    return;
  }

  const [a, b] = withData as [(typeof withData)[number], (typeof withData)[number]];
  console.log(`Claim-Mechanismus: ${RLS_CLAIMS_ENABLED ? "AN" : "AUS"}`);
  console.log(`Mandant A: ${a.name} (${a.n} Epics)`);
  console.log(`Mandant B: ${b.name} (${b.n} Epics)\n`);

  const dbA = createPrismaClient({ userId: SYSTEM_USER, tenantId: a.id });
  let failures = 0;

  console.log("Probe                            eigen   fremd   Urteil");
  for (const probe of PROBES) {
    // Grundwahrheit über den Admin-Client, also ohne Claim-Mechanismus. Ohne sie
    // ließe sich „Policy zu eng" nicht von „Tabelle leer" unterscheiden — und
    // ein Prüfer, der grundlos Alarm schlägt, wird ignoriert.
    const truthOwn = await probe.read(admin, a.id);
    const truthForeign = await probe.read(admin, b.id);
    if (truthOwn === 0 && truthForeign === 0) {
      console.log(
        `${probe.label.padEnd(33)}${"—".padEnd(8)}${"—".padEnd(8)}keine Daten — nicht aussagekräftig`,
      );
      continue;
    }

    const own = await probe.read(dbA, a.id);
    const foreign = await probe.read(dbA, b.id);
    // Ohne aktives RLS ist „fremd sichtbar" der erwartete Zustand — die
    // Isolation liegt dann allein in der Anwendungsschicht.
    const verdict = !RLS_CLAIMS_ENABLED
      ? "RLS aus (Anwendungsschicht schützt)"
      : truthForeign > 0 && foreign > 0
        ? "UNGESCHÜTZT — fremder Mandant sichtbar"
        : truthOwn > 0 && own === 0
          ? "ZU ENG — eigener Mandant sieht nichts"
          : "ok";
    if (verdict.startsWith("ZU ENG") || verdict.startsWith("UNGESCHÜTZT")) failures += 1;
    console.log(
      `${probe.label.padEnd(33)}${String(own).padEnd(8)}${String(foreign).padEnd(8)}${verdict}`,
    );
  }

  // Ladezeit: der Grund, warum der Mechanismus ausgebaut wurde.
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) await dbA.initiative.count({ where: { tenantId: a.id } });
  const ms = (Date.now() - t0) / 20;
  console.log(
    `\nØ Laufzeit je Abfrage: ${ms.toFixed(1)} ms (20 Läufe, ${RLS_CLAIMS_ENABLED ? "mit" : "ohne"} Claim)`,
  );

  console.log(
    failures === 0
      ? "\nBefund: unauffällig."
      : `\nBefund: ${failures} Probe(n) auffällig — NICHT scharf schalten.`,
  );
  await admin.$disconnect();
}

void main();
